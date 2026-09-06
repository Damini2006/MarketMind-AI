from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..ml.churn import generate_churn_predictions


router = APIRouter(
    prefix="/api/ai/churn",
    tags=["AI - Churn"],
)


@router.get("")
def get_churn_predictions(
    db: Session = Depends(get_db),
):
    return generate_churn_predictions(db)