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

# Training-domain values (ML/datasets/sales_data.csv). The frontend lets
# users type anything ("Festival", "Monsoon"...); values outside the
# training domain get mapped to the closest known bucket so the forest
# sees categories it actually learned -- not silent unknown-level garbage.
CATEGORY_VALUES = ["Electronics", "Clothing", "Groceries", "Toys", "Furniture"]
REGION_VALUES = ["North", "South", "East", "West"]
SEASONALITY_VALUES = ["Winter", "Spring", "Summer", "Autumn"]
PROMOTION_VALUES = ["Yes", "No"]

# Demand/Price stats from the training set, used to clamp wild inputs into a
# range the forest can handle (trees cannot extrapolate beyond training range).
DEMAND_MIN, DEMAND_MAX = 4.0, 430.0
PRICE_MIN, PRICE_MAX = 5.0, 228.0


def _normalize_inputs(category, region, seasonality, demand, price, promotion):
    """Map free-text inputs onto the model's training domain."""
    def _match(value, choices):
        v = (value or "").strip().lower()
        if not v:
            return choices[0]
        for c in choices:
            if c.lower() == v:
                return c
        for c in choices:  # substring match: "festival" -> a known bucket
            if v in c.lower() or c.lower() in v:
                return c
        return choices[0]

    cat = _match(category, CATEGORY_VALUES)
    reg = _match(region, REGION_VALUES)
    # Seasonality synonyms used across the UI copy.
    season_map = {
        "festival": "Autumn", "festive": "Autumn", "monsoon": "Autumn",
        "regular": "Spring", "normal": "Spring", "steady": "Spring",
        "peak": "Summer", "holiday": "Winter", "off": "Winter",
    }
    sea_raw = (seasonality or "").strip().lower()
    sea = season_map.get(sea_raw) or _match(seasonality, SEASONALITY_VALUES)

    promo_raw = (promotion or "").strip().lower()
    if promo_raw in ("yes", "y", "true", "1", "active", "on"):
        pro = "Yes"
    elif promo_raw in ("no", "n", "false", "0", "inactive", "off", ""):
        pro = "No"
    else:
        pro = "Yes" if promo_raw else "No"

    try:
        dem = max(0.0, float(demand))
    except (TypeError, ValueError):
        dem = 100.0
    try:
        prc = max(0.0, float(price))
    except (TypeError, ValueError):
        prc = 64.0

    dem_clamped = min(max(dem, DEMAND_MIN), DEMAND_MAX)
    prc_clamped = min(max(prc, PRICE_MIN), PRICE_MAX)

    return {
        "Category": cat, "Region": reg, "Seasonality": sea, "Promotion": pro,
        "Demand": dem_clamped, "Price": prc_clamped,
        "demand_raw": dem, "price_raw": prc,
    }


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

    Falls back to a transparent heuristic when the model file is missing.
    Inputs are normalized onto the training domain first, and the response
    reports which engine answered plus the inputs actually used.
    """
    import pandas as pd

    norm = _normalize_inputs(category, region, seasonality, demand, price, promotion)

    model = _get_revenue_model()
    if model is not None:
        try:
            input_data = pd.DataFrame([{
                "Category": norm["Category"],
                "Region": norm["Region"],
                "Seasonality": norm["Seasonality"],
                "Demand": norm["Demand"],
                "Price": norm["Price"],
                "Promotion": norm["Promotion"],
            }])
            prediction = float(model.predict(input_data)[0])
            prediction = max(prediction, 0.0)
            return {
                "predicted_revenue": round(prediction, 2),
                "engine": "model",
                "inputs_used": {
                    "category": norm["Category"], "region": norm["Region"],
                    "seasonality": norm["Seasonality"], "demand": norm["Demand"],
                    "price": norm["Price"], "promotion": norm["Promotion"],
                },
            }
        except Exception as exc:  # corrupted pkl / sklearn version mismatch
            import logging
            logging.getLogger(__name__).warning(
                "Revenue model predict failed (%s) — using heuristic fallback.", exc
            )

    # Fallback: transparent heuristic when the model is unavailable.
    base = norm["demand_raw"] * norm["price_raw"]
    promo_mult = 1.15 if norm["Promotion"] == "Yes" else 1.0
    season_mult = {"Winter": 1.1, "Summer": 1.05, "Spring": 1.0, "Autumn": 1.08}.get(
        norm["Seasonality"], 1.0
    )
    return {
        "predicted_revenue": round(base * promo_mult * season_mult, 2),
        "engine": "heuristic",
        "inputs_used": {
            "category": norm["Category"], "region": norm["Region"],
            "seasonality": norm["Seasonality"], "demand": norm["demand_raw"],
            "price": norm["price_raw"], "promotion": norm["Promotion"],
        },
    }


def explain_prediction(category, region, seasonality, demand, price, promotion):
    """Factor breakdown FAITHFUL to the model's own prediction.

    Builds counterfactual baselines around the actual input and re-runs the
    SAME trained model on each, then decomposes the prediction exactly:

        Base (Demand × Price)       — the model's answer for an average sale
        Demand effect               — prediction minus base, from demand
        Price effect                — prediction minus base, from price
        Promotion boost             — Yes minus No, everything else fixed
        Season / Category / Region  — residual context effect

    The factors sum EXACTLY to the predicted revenue, so the on-screen
    breakdown can never disagree with the headline number (previously the
    frontend generated the bars with hard-coded percentages and Math.random()).
    """
    import pandas as pd

    norm = _normalize_inputs(category, region, seasonality, demand, price, promotion)
    model = _get_revenue_model()

    def _run(inputs):
        frame = pd.DataFrame([inputs])
        return float(max(model.predict(frame)[0], 0.0))

    if model is not None:
        try:
            base_inputs = dict(norm)
            # Average Demand × Price in the training set -- the "typical sale".
            base_inputs["Demand"] = (DEMAND_MIN + DEMAND_MAX) / 2
            base_inputs["Price"] = (PRICE_MIN + PRICE_MAX) / 2
            base = _run(base_inputs)

            actual = _run(norm)  # == the headline prediction

            # One-factor-at-a-time counterfactuals around the actual input.
            no_promo = dict(norm); no_promo["Promotion"] = "No"
            promo_contrib = actual - _run(no_promo)

            neutral_season = dict(norm); neutral_season["Seasonality"] = "Spring"
            season_contrib = actual - _run(neutral_season)

            # Demand & price effects measured against the training-average
            # level, holding everything else at the user's input.
            demand_only = dict(norm)
            demand_only["Price"] = base_inputs["Price"]
            demand_contrib = _run(demand_only) - base

            price_only = dict(norm)
            price_only["Demand"] = base_inputs["Demand"]
            price_contrib = _run(price_only) - base

            # Residual = everything not captured above (category/region mix
            # and interaction effects). Keeps the sum exact.
            context_contrib = actual - base - promo_contrib - season_contrib \
                - demand_contrib - price_contrib

            factors = [
                {"label": "Base Revenue", "value": round(base, 2),
                 "description": "Model output for an average sale (typical Demand × Price)"},
                {"label": "Demand Effect", "value": round(demand_contrib, 2),
                 "description": "Impact of your expected demand vs. the average"},
                {"label": "Price Effect", "value": round(price_contrib, 2),
                 "description": "Impact of your price point vs. the average"},
                {"label": "Promotion Boost", "value": round(promo_contrib, 2),
                 "description": "Difference the active promotion makes"},
                {"label": "Season Effect", "value": round(season_contrib, 2),
                 "description": "Seasonality impact vs. a neutral season"},
                {"label": "Category & Region", "value": round(context_contrib, 2),
                 "description": "Category/region mix and interaction effects"},
            ]
            return {
                "predicted_revenue": round(actual, 2),
                "engine": "model",
                "factors": factors,
                "sum_check": round(sum(f["value"] for f in factors), 2),
                "inputs_used": {
                    "category": norm["Category"], "region": norm["Region"],
                    "seasonality": norm["Seasonality"], "demand": norm["Demand"],
                    "price": norm["Price"], "promotion": norm["Promotion"],
                },
            }
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "Revenue explanation failed (%s) — using heuristic factors.", exc
            )

    # Heuristic breakdown (model missing) — still sums exactly.
    base = norm["demand_raw"] * norm["price_raw"]
    promo_boost = base * 0.15 if norm["Promotion"] == "Yes" else 0.0
    season_mult = {"Winter": 1.1, "Summer": 1.05, "Spring": 1.0, "Autumn": 1.08}.get(
        norm["Seasonality"], 1.0
    )
    season_boost = base * (season_mult - 1.0)
    total = base + promo_boost + season_boost
    factors = [
        {"label": "Base Revenue", "value": round(base, 2), "description": "Demand × Price"},
        {"label": "Promotion Boost", "value": round(promo_boost, 2), "description": "+15% when a promotion is active"},
        {"label": "Season Effect", "value": round(season_boost, 2), "description": "Seasonal uplift"},
    ]
    return {
        "predicted_revenue": round(total, 2),
        "engine": "heuristic",
        "factors": factors,
        "sum_check": round(sum(f["value"] for f in factors), 2),
        "inputs_used": {
            "category": norm["Category"], "region": norm["Region"],
            "seasonality": norm["Seasonality"], "demand": norm["demand_raw"],
            "price": norm["price_raw"], "promotion": norm["Promotion"],
        },
    }
