from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

@router.get("/", response_model=List[schemas.UploadedDatasetOut])
def list_datasets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.UploadedDataset).filter(models.UploadedDataset.business_id == current_user.business_id).order_by(models.UploadedDataset.upload_date.desc()).all()
