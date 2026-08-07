import io
from typing import List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("/", response_model=List[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Customer).filter(models.Customer.business_id == current_user.business_id).order_by(models.Customer.id.desc()).all()


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
    return customer


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.business_id == current_user.business_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "business_owner")),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.business_id == current_user.business_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return None


@router.post("/upload-csv")
def upload_customers_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "sales_executive", "admin")),
):
    """
    Bulk-import customers from a CSV.
    Required column: full_name. Optional columns: email, phone, gender, address.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    
    if "full_name" not in df.columns:
        if "first_name" in df.columns and "last_name" in df.columns:
            df["full_name"] = df["first_name"].astype(str) + " " + df["last_name"].astype(str)
        elif "name" in df.columns:
            df["full_name"] = df["name"]
        else:
            raise HTTPException(status_code=422, detail="CSV must contain a 'full_name' column")

    df = df.dropna(subset=["full_name"])

    # Create dataset tracking record
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
    for _, row in df.iterrows():
        full_name = str(row["full_name"]).strip()
        if not full_name:
            skipped += 1
            continue
            
        existing = db.query(models.Customer).filter(
            models.Customer.full_name == full_name,
            models.Customer.business_id == current_user.business_id
        ).first()
        
        if existing:
            skipped += 1
            continue
            
        db.add(
            models.Customer(
                business_id=current_user.business_id,
                full_name=full_name,
                email=str(row["email"]).strip() if "email" in df.columns and pd.notna(row.get("email")) else None,
                phone=str(row["phone"]).strip() if "phone" in df.columns and pd.notna(row.get("phone")) else None,
                gender=str(row["gender"]).strip() if "gender" in df.columns and pd.notna(row.get("gender")) else None,
                address=str(row["address"]).strip() if "address" in df.columns and pd.notna(row.get("address")) else None,
            )
        )
        created += 1

    dataset.valid_records = created
    dataset.invalid_records = skipped
    db.commit()
    
    return {"rows_processed": int(len(df)), "customers_created": created, "rows_skipped": skipped, "dataset_id": dataset.id}
