import io
from typing import List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


def _check_and_create_alert(db: Session, inventory: models.Inventory, product_name: str, business_id: int):
    if inventory.quantity_available <= inventory.reorder_level:
        existing = (
            db.query(models.Alert)
            .filter(
                models.Alert.alert_type == "inventory", 
                models.Alert.title.like(f"%{product_name}%"),
                models.Alert.is_read == False,
                models.Alert.business_id == business_id
            )
            .first()
        )
        if not existing:
            priority = "critical" if inventory.quantity_available == 0 else "high"
            alert = models.Alert(
                alert_type="inventory",
                title=f"Low Stock: {product_name}",
                description=f"Only {inventory.quantity_available} left (threshold: {inventory.reorder_level}).",
                priority=priority,
                business_id=business_id
            )
            db.add(alert)
            db.commit()


@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Product).filter(models.Product.business_id == current_user.business_id).order_by(models.Product.id.desc()).all()


@router.get("/stock", response_model=List[schemas.InventoryOut])
def list_stock(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Inventory).join(models.Product).filter(models.Product.business_id == current_user.business_id).all()


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
):
    product_data = payload.model_dump(exclude={"stock_quantity", "reorder_level", "warehouse_location"})
    product = models.Product(**product_data, business_id=current_user.business_id)
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # Create associated inventory
    inventory = models.Inventory(
        product_id=product.id,
        quantity_available=payload.stock_quantity,
        reorder_level=payload.reorder_level,
        warehouse_location=payload.warehouse_location
    )
    db.add(inventory)
    
    # Create initial transaction if stock > 0
    if payload.stock_quantity > 0:
        tx = models.InventoryTransaction(
            product_id=product.id,
            user_id=current_user.id,
            transaction_type="IN",
            quantity=payload.stock_quantity,
            remarks="Initial stock setup"
        )
        db.add(tx)
        
    db.commit()
    _check_and_create_alert(db, inventory, product.name, current_user.business_id)
    
    return product


@router.patch("/products/{product_id}/stock", response_model=schemas.InventoryOut)
def update_stock(
    product_id: int,
    payload: schemas.StockUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
):
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.business_id == current_user.business_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    inventory = db.query(models.Inventory).filter(models.Inventory.product_id == product_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")
        
    inventory.quantity_available = max(0, inventory.quantity_available + payload.quantity_delta)
    
    tx = models.InventoryTransaction(
        product_id=product.id,
        user_id=current_user.id,
        transaction_type=payload.transaction_type,
        quantity=abs(payload.quantity_delta) if payload.quantity_delta > 0 else -abs(payload.quantity_delta),
        remarks=payload.remarks or "Manual adjustment"
    )
    db.add(tx)
    
    db.commit()
    db.refresh(inventory)
    _check_and_create_alert(db, inventory, product.name, current_user.business_id)
    
    return inventory


@router.get("/alerts", response_model=List[schemas.AlertOut])
def list_alerts(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(models.Alert)
        .filter(models.Alert.is_read == False, models.Alert.business_id == current_user.business_id)
        .order_by(models.Alert.created_at.desc())
        .all()
    )


@router.post("/products/upload-csv")
def upload_products_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
):
    """
    Bulk-import a product catalog / inventory list from CSV.
    Required columns: name, selling_price. 
    Optional: purchase_price, category_name, supplier_name, stock_quantity, reorder_level, warehouse_location.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    
    # Handle old price column if present
    if "price" in df.columns and "selling_price" not in df.columns:
        df["selling_price"] = df["price"]
        
    required = {"name", "selling_price"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"CSV missing required columns: {sorted(missing)}")

    df["selling_price"] = pd.to_numeric(df["selling_price"], errors="coerce")
    df = df.dropna(subset=["name", "selling_price"])

    dataset = models.UploadedDataset(
        uploaded_by=current_user.id,
        business_id=current_user.business_id,
        file_name=file.filename,
        total_records=len(df),
        validation_status="processed"
    )
    db.add(dataset)
    db.flush()

    created, updated, skipped = 0, 0, 0
    for _, row in df.iterrows():
        name = str(row["name"]).strip()
        if not name:
            skipped += 1
            continue
            
        stock_qty = int(row["stock_quantity"]) if "stock_quantity" in df.columns and pd.notna(row.get("stock_quantity")) else 0
        reorder = int(row["reorder_level"]) if "reorder_level" in df.columns and pd.notna(row.get("reorder_level")) else 10

        category_id = None
        if "category_name" in df.columns and pd.notna(row.get("category_name")):
            cat_name = str(row["category_name"]).strip()
            if cat_name:
                category = db.query(models.Category).filter(models.Category.category_name == cat_name, models.Category.business_id == current_user.business_id).first()
                if not category:
                    category = models.Category(category_name=cat_name, business_id=current_user.business_id)
                    db.add(category)
                    db.flush()
                category_id = category.id

        existing = db.query(models.Product).filter(models.Product.name == name, models.Product.business_id == current_user.business_id).first()
        if existing:
            existing.selling_price = float(row["selling_price"])
            if category_id:
                existing.category_id = category_id
            if "purchase_price" in df.columns and pd.notna(row.get("purchase_price")):
                existing.purchase_price = float(row["purchase_price"])
                
            inv = db.query(models.Inventory).filter(models.Inventory.product_id == existing.id).first()
            if inv:
                if "stock_quantity" in df.columns and pd.notna(row.get("stock_quantity")):
                    inv.quantity_available = stock_qty
                if "warehouse_location" in df.columns and pd.notna(row.get("warehouse_location")):
                    inv.warehouse_location = str(row["warehouse_location"]).strip()
                _check_and_create_alert(db, inv, existing.name, current_user.business_id)
                
            updated += 1
        else:
            product = models.Product(
                name=name,
                business_id=current_user.business_id,
                category_id=category_id,
                selling_price=float(row["selling_price"]),
                purchase_price=float(row["purchase_price"]) if "purchase_price" in df.columns and pd.notna(row.get("purchase_price")) else 0.0,
            )
            db.add(product)
            db.flush()
            
            inv = models.Inventory(
                product_id=product.id,
                quantity_available=stock_qty,
                reorder_level=reorder,
                warehouse_location=str(row["warehouse_location"]).strip() if "warehouse_location" in df.columns and pd.notna(row.get("warehouse_location")) else None
            )
            db.add(inv)
            
            if stock_qty > 0:
                db.add(models.InventoryTransaction(
                    product_id=product.id, user_id=current_user.id, transaction_type="IN", quantity=stock_qty, remarks="CSV Upload"
                ))
            
            db.flush()
            created += 1
            _check_and_create_alert(db, inv, product.name, current_user.business_id)

    dataset.valid_records = created + updated
    dataset.invalid_records = skipped
    db.commit()
    
    return {"rows_processed": int(len(df)), "products_created": created, "products_updated": updated, "rows_skipped": skipped, "dataset_id": dataset.id}
