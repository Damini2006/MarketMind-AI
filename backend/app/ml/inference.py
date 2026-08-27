from datetime import datetime, timedelta
from typing import List, Dict, Any

import warnings
warnings.filterwarnings("ignore", message=".*Trying to unpickle estimator.*")


# Mock functions for ML Inference
# When real models are available, load them at app startup (e.g., using lifespan events)
# and replace these dummy implementations with actual model.predict() calls.

def predict_revenue_forecast() -> Dict[str, Any]:
    """Mock revenue forecast."""
    today = datetime.now()
    history = [
        {"date": (today - timedelta(days=i)).strftime("%Y-%m-%d"), "revenue": 1000 + (i * 50)} 
        for i in range(14, 0, -1)
    ]
    forecast = [
        {"date": (today + timedelta(days=i)).strftime("%Y-%m-%d"), "predicted_revenue": 1500 + (i * 100)} 
        for i in range(1, 15)
    ]
    return {
        "history": history,
        "forecast": forecast,
        "metrics": {"mape": 0.05, "confidence_interval": 0.95}
    }

def predict_customer_churn() -> Dict[str, Any]:
    """Mock customer churn predictions."""
    results = [
        {"customer_id": 101, "customer_name": "Alice Smith", "churn_probability": 0.85, "retention_risk": "High"},
        {"customer_id": 102, "customer_name": "Bob Johnson", "churn_probability": 0.65, "retention_risk": "Medium"},
        {"customer_id": 103, "customer_name": "Charlie Brown", "churn_probability": 0.15, "retention_risk": "Low"},
        {"customer_id": 104, "customer_name": "Diana Prince", "churn_probability": 0.92, "retention_risk": "High"},
        {"customer_id": 105, "customer_name": "Evan Wright", "churn_probability": 0.55, "retention_risk": "Medium"},
        {"customer_id": 106, "customer_name": "Fiona Gallagher", "churn_probability": 0.78, "retention_risk": "High"},
        {"customer_id": 107, "customer_name": "George Miller", "churn_probability": 0.88, "retention_risk": "High"},
        {"customer_id": 108, "customer_name": "Hannah Abbott", "churn_probability": 0.72, "retention_risk": "High"},
        {"customer_id": 109, "customer_name": "Ian Somerhalder", "churn_probability": 0.95, "retention_risk": "High"},
        {"customer_id": 110, "customer_name": "Julia Roberts", "churn_probability": 0.81, "retention_risk": "High"},
        {"customer_id": 111, "customer_name": "Kevin Hart", "churn_probability": 0.79, "retention_risk": "High"},
    ]
    # Filter for high risk (should return exactly 8 to match previous UI mock state temporarily)
    high_risk = [r for r in results if r["churn_probability"] > 0.7]
    return {
        "results": high_risk,
        "metrics": {"total_high_risk": len(high_risk), "accuracy": 0.89}
    }


# ── Revenue Prediction using trained model ──────────────────────────

# Lazy-load the trained model to avoid import errors when the pkl file
# is not yet present (e.g. fresh clone without trained_models/).
_model = None
_model_load_attempted = False


def _get_revenue_model():
    """Load the revenue prediction model on first use."""
    global _model, _model_load_attempted
    if _model_load_attempted:
        return _model
    _model_load_attempted = True
    try:
        import joblib
        import os
        MODEL_PATH = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "trained_models",
            "revenue_prediction_compressed.pkl",
        )
        if os.path.exists(MODEL_PATH):
            _model = joblib.load(MODEL_PATH)
        else:
            import logging
            logging.getLogger(__name__).warning(
                "Revenue prediction model not found at %s — predict_revenue will return mock data.", MODEL_PATH
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to load revenue model: %s", e)
    return _model


def predict_revenue(category, region, seasonality, demand, price, promotion):
    """
    Predict revenue using the trained model.

    Falls back to a mock calculation if the model is unavailable.
    """
    import pandas as pd

    model = _get_revenue_model()
    if model is not None:
        input_data = pd.DataFrame([{
            "Category": category,
            "Region": region,
            "Seasonality": seasonality,
            "Demand": demand,
            "Price": price,
            "Promotion": promotion
        }])
        prediction = model.predict(input_data)
        return {"predicted_revenue": float(prediction[0])}

    # Fallback: simple heuristic when model is missing
    base = demand * price
    promo_mult = 1.15 if promotion and promotion.lower() in ("yes", "true", "1") else 1.0
    season_mult = {"high": 1.2, "peak": 1.3, "low": 0.8, "off": 0.7}.get(
        (seasonality or "").lower(), 1.0
    )
    return {"predicted_revenue": round(base * promo_mult * season_mult, 2)}
