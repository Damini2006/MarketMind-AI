from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user
from app.ml.inference import predict_revenue, explain_prediction

router = APIRouter(
    prefix="/api/revenue",
    tags=["Revenue Forecasting"]
)


class RevenueInput(BaseModel):
    category: str
    region: str
    seasonality: str
    demand: float = Field(gt=0, description="Expected demand in units")
    price: float = Field(gt=0, description="Price per unit in ₹")
    promotion: str


def _check_input(data: RevenueInput) -> None:
    """Reject absurd inputs early with a clear message instead of returning
    a garbage prediction."""
    if data.demand > 1_000_000:
        raise HTTPException(422, "Demand looks unrealistic (> 1,000,000 units).")
    if data.price > 10_000_000:
        raise HTTPException(422, "Price looks unrealistic (> ₹1,00,00,000 per unit).")


@router.post("/predict")
def get_revenue_prediction(
    data: RevenueInput,
    current_user=Depends(get_current_user),
):
    _check_input(data)
    result = predict_revenue(
        category=data.category,
        region=data.region,
        seasonality=data.seasonality,
        demand=data.demand,
        price=data.price,
        promotion=data.promotion,
    )
    return result


@router.post("/explain")
def get_revenue_explanation(
    data: RevenueInput,
    current_user=Depends(get_current_user),
):
    """Factor breakdown derived from the SAME trained model as the headline
    prediction — the bars always sum exactly to the predicted revenue."""
    _check_input(data)
    return explain_prediction(
        category=data.category,
        region=data.region,
        seasonality=data.seasonality,
        demand=data.demand,
        price=data.price,
        promotion=data.promotion,
    )
