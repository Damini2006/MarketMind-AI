from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas, models
from app.deps import get_current_user, require_roles
from app.ml import inference

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/forecast", response_model=schemas.ForecastResponse)
def get_forecast(
    current_user: models.User = Depends(require_roles(models.RoleEnum.business_owner.value, models.RoleEnum.admin.value))
):
    """Get revenue forecast (currently mock ML inference)."""
    return inference.predict_revenue_forecast()


@router.get("/churn", response_model=schemas.ChurnResponse)
def get_churn_predictions(
    current_user: models.User = Depends(require_roles(models.RoleEnum.business_owner.value, models.RoleEnum.admin.value))
):
    """Get customer churn predictions (currently mock ML inference)."""
    return inference.predict_customer_churn()
