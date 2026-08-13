from fastapi import APIRouter
from ml.forecasting import train_sales_forecast

router = APIRouter(
    prefix="/api/forecast",
    tags=["Forecasting"]
)

@router.get("")
def get_forecast():
    df = train_sales_forecast("app/datasets/sales_data.csv")

    # result = df[
    #     [
    #         "Actual Units Sold",
    #         "Predicted Units Sold"
    #     ]
    # ].head(100)
    result = df.head(100)

    return result.to_dict(orient="records")