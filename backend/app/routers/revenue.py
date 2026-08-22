from fastapi import APIRouter
from pydantic import BaseModel
from app.ml.inference import predict_revenue

router = APIRouter(
    prefix="/api/revenue",
    tags=["Revenue Forecasting"]
)


class RevenueInput(BaseModel):
    category: str
    region: str
    seasonality: str
    demand: float
    price: float
    promotion: str


@router.post("/predict")
def get_revenue_prediction(data: RevenueInput):

    result = predict_revenue(
        category=data.category,
        region=data.region,
        seasonality=data.seasonality,
        demand=data.demand,
        price=data.price,
        promotion=data.promotion
    )

    return result