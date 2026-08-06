import io
from typing import List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


def _check_and_create_alert(db: Session, product: models.Product):
    if product.stock_quantity <= product.reorder_threshold:
        existing = (
            db.query(models.InventoryAlert)
            .filter(models.InventoryAlert.product_id == product.id, models.InventoryAlert.resolved == False)  # noqa: E712
            .first()
        )
        if not existing:
            level = "critical" if product.stock_quantity == 0 else "warning"
            alert = models.InventoryAlert(
                product_id=product.id,
                message=f"'{product.name}' stock is low ({product.stock_quantity} left, reorder threshold {product.reorder_threshold}).",
                level=level,
            )
            db.add(alert)
            db.commit()
    else:
        db.query(models.InventoryAlert).filter(
            models.InventoryAlert.product_id == product.id, models.InventoryAlert.resolved == False  # noqa: E712
        ).update({"resolved": True})
        db.commit()


@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Product).order_by(models.Product.id.desc()).all()


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    _check_and_create_alert(db, product)
    return product


@router.patch("/products/{product_id}/stock", response_model=schemas.ProductOut)
def update_stock(
    product_id: int,
    payload: schemas.StockUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.stock_quantity = max(0, product.stock_quantity + payload.quantity_delta)
    db.commit()
    db.refresh(product)
    _check_and_create_alert(db, product)
    return product


@router.get("/alerts", response_model=List[schemas.InventoryAlertOut])
def list_alerts(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(models.InventoryAlert)
        .filter(models.InventoryAlert.resolved == False)  # noqa: E712
        .order_by(models.InventoryAlert.created_at.desc())
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
    Required columns: name, price. Optional: category, stock_quantity, reorder_threshold, warehouse_location.
    Existing products (matched by name, case/whitespace-insensitive) get their price/stock updated rather than duplicated.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    required = {"name", "price"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"CSV missing required columns: {sorted(missing)}")

    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df.dropna(subset=["name", "price"])

    created, updated, skipped = 0, 0, 0
    for _, row in df.iterrows():
        name = str(row["name"]).strip()
        if not name:
            skipped += 1
            continue
        stock_qty = int(row["stock_quantity"]) if "stock_quantity" in df.columns and pd.notna(row.get("stock_quantity")) else 0
        reorder = int(row["reorder_threshold"]) if "reorder_threshold" in df.columns and pd.notna(row.get("reorder_threshold")) else 10

        existing = (
            db.query(models.Product)
            .filter(func.lower(func.trim(models.Product.name)) == name.lower())
            .first()
        )
        if existing:
            existing.price = float(row["price"])
            if "stock_quantity" in df.columns and pd.notna(row.get("stock_quantity")):
                existing.stock_quantity = stock_qty
            if "category" in df.columns and pd.notna(row.get("category")):
                existing.category = str(row["category"]).strip()
            if "warehouse_location" in df.columns and pd.notna(row.get("warehouse_location")):
                existing.warehouse_location = str(row["warehouse_location"]).strip()
            updated += 1
            _check_and_create_alert(db, existing)
        else:
            product = models.Product(
                name=name,
                category=str(row["category"]).strip() if "category" in df.columns and pd.notna(row.get("category")) else None,
                price=float(row["price"]),
                stock_quantity=stock_qty,
                reorder_threshold=reorder,
                warehouse_location=str(row["warehouse_location"]).strip() if "warehouse_location" in df.columns and pd.notna(row.get("warehouse_location")) else None,
            )
            db.add(product)
            db.flush()
            created += 1
            _check_and_create_alert(db, product)

    db.commit()
    return {"rows_processed": int(len(df)), "products_created": created, "products_updated": updated, "rows_skipped": skipped}