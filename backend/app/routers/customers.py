import io
from typing import List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas
from ..cache import get_or_set, invalidate
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("/", response_model=List[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    def _load():
        return [
            schemas.CustomerOut.model_validate(c).model_dump(mode="json")
            for c in db.query(models.Customer)
            .filter(models.Customer.business_id == current_user.business_id)
            .order_by(models.Customer.id.desc())
            .all()
        ]

    return get_or_set(f"customers_list:{current_user.business_id}", 60, _load)


@router.post("/", response_model=schemas.CustomerOut, status_code=201)
def create_customer(
    payload: schemas.CustomerCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "sales_executive", "admin")),
):
    customer = models.Customer(**payload.model_dump(), business_id=current_user.business_id)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    invalidate("customers_list:")
    return customer


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    customer = (
        db.query(models.Customer)
        .filter(
            models.Customer.id == customer_id,
            models.Customer.business_id == current_user.business_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "business_owner")),
):
    customer = (
        db.query(models.Customer)
        .filter(
            models.Customer.id == customer_id,
            models.Customer.business_id == current_user.business_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    invalidate("customers_list:")
    return None


@router.post("/upload-csv")
def upload_customers_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "sales_executive", "admin")),
):
    """
    Bulk-import customers from a CSV.
    Required column: name. Optional columns: email, phone.
    Existing customers (matched by name, case/whitespace-insensitive) are skipped, not duplicated.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    if "name" not in df.columns:
        raise HTTPException(status_code=422, detail="CSV must contain a 'name' column")

    df = df.dropna(subset=["name"])

    created, skipped = 0, 0
    for _, row in df.iterrows():
        name = str(row["name"]).strip()
        if not name:
            skipped += 1
            continue
        existing = (
            db.query(models.Customer)
            .filter(
                func.lower(func.trim(models.Customer.name)) == name.lower(),
                models.Customer.business_id == current_user.business_id,
            )
            .first()
        )
        if existing:
            skipped += 1
            continue
        db.add(
            models.Customer(
                name=name,
                email=str(row["email"]).strip() if "email" in df.columns and pd.notna(row.get("email")) else None,
                phone=str(row["phone"]).strip() if "phone" in df.columns and pd.notna(row.get("phone")) else None,
                business_id=current_user.business_id,
            )
        )
        created += 1

    db.commit()
    invalidate("customers_list:")
    return {"rows_processed": int(len(df)), "customers_created": created, "rows_skipped": skipped}