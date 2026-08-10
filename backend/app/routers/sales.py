import io
import datetime as dt
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles
from .inventory import _check_and_create_alert

router = APIRouter(prefix="/api/sales", tags=["Sales"])

REQUIRED_CSV_COLUMNS = {"product_name", "quantity", "unit_price"}


@router.get("/", response_model=List[schemas.SaleOut])
def list_sales(
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(models.Sale).options(joinedload(models.Sale.sale_items)).filter(models.Sale.business_id == current_user.business_id).order_by(models.Sale.sale_date.desc()).limit(limit).all()


@router.post("/", response_model=schemas.SaleOut, status_code=201)
def create_sale(
    payload: schemas.SaleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Sale must contain at least one item")
        
    sale_date = payload.sale_date or dt.datetime.utcnow()
    invoice_number = f"INV-{sale_date.strftime('%Y%m%d%H%M%S')}"

    customer_id = payload.customer_id
    if not customer_id and payload.customer_name:
        customer = db.query(models.Customer).filter(models.Customer.full_name == payload.customer_name, models.Customer.business_id == current_user.business_id).first()
        if not customer:
            customer = models.Customer(full_name=payload.customer_name, business_id=current_user.business_id)
            db.add(customer)
            db.flush()
        customer_id = customer.id

    sale = models.Sale(
        business_id=current_user.business_id,
        invoice_number=invoice_number,
        customer_id=customer_id,
        user_id=current_user.id,
        payment_status="completed",
        payment_method=payload.payment_method,
        sale_date=sale_date,
    )
    db.add(sale)
    db.flush()

    subtotal = 0.0
    for item in payload.items:
        total = item.unit_price * item.quantity - item.discount
        subtotal += total
        
        sale_item = models.SaleItem(
            sale_id=sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount,
            total=total
        )
        db.add(sale_item)
        
        # Deduct inventory
        inventory = db.query(models.Inventory).filter(models.Inventory.product_id == item.product_id).first()
        if inventory:
            inventory.quantity_available = max(0, inventory.quantity_available - item.quantity)
            
            # Record transaction
            tx = models.InventoryTransaction(
                product_id=item.product_id,
                user_id=current_user.id,
                transaction_type="OUT",
                quantity=item.quantity,
                remarks=f"Sale {invoice_number}"
            )
            db.add(tx)
            
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            _check_and_create_alert(db, inventory, product.name if product else "Unknown")
            
    # Apply taxes/discounts at header level if needed
    sale.subtotal = subtotal
    sale.total_amount = subtotal
    
    db.commit()
    
    return db.query(models.Sale).options(joinedload(models.Sale.sale_items)).filter(models.Sale.id == sale.id).first()


@router.post("/upload-csv")
def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    """
    Upload a CSV of historical/point-of-sale transactions.
    Expected columns: product_name, quantity, unit_price, invoice_number (optional), customer_name, sale_date
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    missing = REQUIRED_CSV_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"CSV missing required columns: {sorted(missing)}")

    df = df.dropna(subset=["product_name", "quantity", "unit_price"])
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")
    df = df.dropna(subset=["quantity", "unit_price"])
    df = df[(df["quantity"] > 0) & (df["unit_price"] >= 0)]
    
    # If no invoice_number, group each row as its own sale
    if "invoice_number" not in df.columns:
        df["invoice_number"] = [f"CSV-{dt.datetime.utcnow().timestamp()}-{i}" for i in range(len(df))]

    dataset = models.UploadedDataset(
        uploaded_by=current_user.id,
        business_id=current_user.business_id,
        file_name=file.filename,
        total_records=len(df),
        validation_status="processed"
    )
    db.add(dataset)
    db.flush()

    created, skipped = 0, 0
    grouped = df.groupby("invoice_number")
    
    for inv_num, group in grouped:
        try:
            first_row = group.iloc[0]
            
            customer = None
            if "customer_name" in df.columns and pd.notna(first_row.get("customer_name")):
                c_name = str(first_row["customer_name"]).strip()
                
                customer = db.query(models.Customer).filter(
                    models.Customer.full_name == c_name,
                    models.Customer.business_id == current_user.business_id
                ).first()
                
                if not customer:
                    customer = models.Customer(full_name=c_name, business_id=current_user.business_id)
                    db.add(customer)
                    db.flush()

            sale_date = dt.datetime.utcnow()
            if "sale_date" in df.columns and pd.notna(first_row.get("sale_date")):
                try:
                    sale_date = pd.to_datetime(first_row["sale_date"]).to_pydatetime()
                except Exception:
                    pass

            sale = models.Sale(
                business_id=current_user.business_id,
                invoice_number=str(inv_num),
                customer_id=customer.id if customer else None,
                user_id=current_user.id,
                sale_date=sale_date,
                payment_status="completed"
            )
            db.add(sale)
            db.flush()
            
            subtotal = 0.0
            
            for _, row in group.iterrows():
                product_name = str(row["product_name"]).strip()
                product = db.query(models.Product).filter(models.Product.name == product_name, models.Product.business_id == current_user.business_id).first()
                if not product:
                    product = models.Product(name=product_name, selling_price=float(row["unit_price"]), business_id=current_user.business_id)
                    db.add(product)
                    db.flush()
                    # Add zero-stock inventory
                    inv = models.Inventory(product_id=product.id)
                    db.add(inv)
                    db.flush()

                qty = int(row["quantity"])
                price = float(row["unit_price"])
                item_total = qty * price
                subtotal += item_total
                
                db.add(models.SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=qty,
                    unit_price=price,
                    total=item_total
                ))
                
                # Deduct inventory
                inventory = db.query(models.Inventory).filter(models.Inventory.product_id == product.id).first()
                if inventory:
                    inventory.quantity_available = max(0, inventory.quantity_available - qty)
                    db.add(models.InventoryTransaction(
                        product_id=product.id, user_id=current_user.id, transaction_type="OUT", quantity=qty, remarks=f"CSV Sale {inv_num}"
                    ))
                    _check_and_create_alert(db, inventory, product.name)
            
            sale.subtotal = subtotal
            sale.total_amount = subtotal
            
            # Auto-create invoice for this sale
            invoice = models.Invoice(
                sale_id=sale.id,
                invoice_number=str(inv_num),
                invoice_status="paid" if sale.payment_status == "completed" else "pending",
                payment_date=sale_date if sale.payment_status == "completed" else None
            )
            db.add(invoice)
            
            created += 1
        except Exception:
            skipped += len(group)
            continue

    dataset.valid_records = len(df) - skipped
    dataset.invalid_records = skipped
    db.commit()
    
    return {"rows_processed": int(len(df)), "sales_created": created, "rows_skipped": skipped, "dataset_id": dataset.id}
