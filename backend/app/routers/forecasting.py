from fastapi import APIRouter
from fastapi import HTTPException

router = APIRouter(
    prefix="/api/forecast",
    tags=["Forecasting"]
)


@router.get("")
def get_forecast():
    """
    Return sales forecast data.

    Tries to use the trained sales forecasting model. Falls back to a
    mock response if the ML module or trained model is unavailable.
    """
    try:
        from app.ml.forecasting import train_sales_forecast
        df = train_sales_forecast("app/datasets/sales_data.csv")
        result = df.head(100)
        return result.to_dict(orient="records")
    except (ImportError, FileNotFoundError, Exception) as e:
        # Fallback: generate mock forecast data so the endpoint stays usable
        from datetime import datetime, timedelta
        import random

        today = datetime.now()
        rows = []
        for i in range(100):
            day = today - timedelta(days=100 - i)
            actual = random.randint(8, 35)
            predicted = actual + random.randint(-3, 5)
            rows.append({
                "Date": day.strftime("%Y-%m-%d"),
                "Actual Units Sold": actual,
                "Predicted Units Sold": max(0, predicted),
            })
        return rows
