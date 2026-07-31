import io
import datetime as dt
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

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
    return db.query(models.Sale).order_by(models.Sale.sale_date.desc()).limit(limit).all()


@router.post("/", response_model=schemas.SaleOut, status_code=201)
def create_sale(
    payload: schemas.SaleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    total = payload.unit_price * payload.quantity
    sale = models.Sale(
        customer_id=payload.customer_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        total_amount=total,
        sale_date=payload.sale_date or dt.datetime.utcnow(),
        source="manual",
    )
    db.add(sale)
    if payload.product_id:
        product = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
        if product:
            product.stock_quantity = max(0, product.stock_quantity - payload.quantity)
            db.commit()
            _check_and_create_alert(db, product)
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/upload-csv")
def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    """
    Upload a CSV of historical/point-of-sale transactions.
    Expected columns: product_name, quantity, unit_price, [customer_name], [sale_date]
    Performs validation, auto-creates missing products/customers, and stores transactions.
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

    created, skipped = 0, 0
    for _, row in df.iterrows():
        try:
            product = db.query(models.Product).filter(models.Product.name == str(row["product_name"]).strip()).first()
            if not product:
                product = models.Product(name=str(row["product_name"]).strip(), price=float(row["unit_price"]), stock_quantity=0)
                db.add(product)
                db.flush()

            customer = None
            if "customer_name" in df.columns and pd.notna(row.get("customer_name")):
                cname = str(row["customer_name"]).strip()
                customer = db.query(models.Customer).filter(models.Customer.name == cname).first()
                if not customer:
                    customer = models.Customer(name=cname)
                    db.add(customer)
                    db.flush()

            sale_date = dt.datetime.utcnow()
            if "sale_date" in df.columns and pd.notna(row.get("sale_date")):
                try:
                    sale_date = pd.to_datetime(row["sale_date"]).to_pydatetime()
                except Exception:
                    pass

            qty = int(row["quantity"])
            price = float(row["unit_price"])
            sale = models.Sale(
                customer_id=customer.id if customer else None,
                product_id=product.id,
                quantity=qty,
                unit_price=price,
                total_amount=qty * price,
                sale_date=sale_date,
                source="csv_upload",
            )
            db.add(sale)
            created += 1
        except Exception:
            skipped += 1
            continue

    db.commit()
    return {"rows_processed": int(len(df)), "sales_created": created, "rows_skipped": skipped}
