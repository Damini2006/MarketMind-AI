# """
# Customer Churn Prediction
# ==========================

# Predicts customer inactivity risk using real sales history.

# The system combines:
# - Recency
# - Purchase frequency
# - Average purchase interval
# - Recent activity
# - Previous activity
# - Frequency change
# - Customer value

# The model is trained from historical customer behaviour while
# avoiding large artificial gaps between unrelated dataset periods.

# The API returns plain dictionaries ready for FastAPI/JSON.
# """

from collections import defaultdict
from datetime import datetime, timedelta

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

CHURN_WINDOW_DAYS = 60

RECENT_WINDOW_DAYS = 30
PREVIOUS_WINDOW_DAYS = 30

MIN_ORDERS_FOR_MODEL = 2
MIN_HISTORY_DAYS = 60

# Only use recent data for ML training when possible.
# This prevents the 2010/2011 -> 2026 gap from teaching the model
# that normal customers are automatically churned.
RECENT_TRAINING_DAYS = 365

HIGH_RISK_THRESHOLD = 0.70
MEDIUM_RISK_THRESHOLD = 0.40


FEATURE_COLUMNS = [
    "recency_days",
    "total_orders",
    "total_spent",
    "average_order_value",
    "monthly_order_frequency",
    "average_purchase_interval",
    "recent_orders",
    "previous_orders",
    "frequency_change",
]


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _to_datetime(value):
    """Convert database date/datetime values into datetime."""

    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    return datetime.combine(
        value,
        datetime.min.time(),
    )


# -------------------------------------------------------------------
# Load sales
# -------------------------------------------------------------------

def _load_sales(db):
    """Load all customer sales history with one database query."""

    from .. import models

    rows = (
        db.query(
            models.Sale.customer_id,
            models.Sale.sale_date,
            models.Sale.total_amount,
        )
        .filter(
            models.Sale.customer_id.isnot(None),
            models.Sale.sale_date.isnot(None),
        )
        .order_by(models.Sale.sale_date)
        .all()
    )

    sales = []

    for row in rows:
        sale_date = _to_datetime(row.sale_date)

        if sale_date is None:
            continue

        sales.append(
            {
                "customer_id": row.customer_id,
                "sale_date": sale_date,
                "total_amount": float(row.total_amount or 0),
            }
        )

    return sales


# -------------------------------------------------------------------
# Customer purchase interval
# -------------------------------------------------------------------

def _calculate_average_interval(dates):
    """
    Calculate a customer's typical purchase interval.

    Median is used instead of mean so one unusual gap does not
    completely distort the customer's normal behaviour.
    """

    if len(dates) < 2:
        return None

    intervals = []

    for previous, current in zip(dates[:-1], dates[1:]):
        days = (current - previous).days

        if days > 0:
            intervals.append(days)

    if not intervals:
        return None

    return float(pd.Series(intervals).median())


# -------------------------------------------------------------------
# Build customer features
# -------------------------------------------------------------------

def _build_features(sales, cutoff_date):
    """
    Build customer behaviour features using purchases up to cutoff_date.
    """

    customer_sales = defaultdict(list)

    for sale in sales:
        if sale["sale_date"] <= cutoff_date:
            customer_sales[sale["customer_id"]].append(sale)

    features = {}

    for customer_id, purchases in customer_sales.items():

        if not purchases:
            continue

        purchases.sort(
            key=lambda x: x["sale_date"]
        )

        dates = [
            purchase["sale_date"]
            for purchase in purchases
        ]

        # -----------------------------------------------------------
        # Recency
        # -----------------------------------------------------------

        last_purchase = dates[-1]

        recency_days = max(
            (cutoff_date - last_purchase).days,
            0,
        )

        # Don't allow enormous historical gaps to dominate.
        recency_days = min(recency_days, 730)

        # -----------------------------------------------------------
        # Customer value
        # -----------------------------------------------------------

        total_orders = len(purchases)

        total_spent = sum(
            purchase["total_amount"]
            for purchase in purchases
        )

        average_order_value = (
            total_spent / total_orders
            if total_orders > 0
            else 0
        )

        # -----------------------------------------------------------
        # Purchase frequency
        # -----------------------------------------------------------

        first_purchase = dates[0]

        history_days = max(
            (cutoff_date - first_purchase).days,
            1,
        )

        monthly_order_frequency = (
            total_orders / history_days
        ) * 30

        # -----------------------------------------------------------
        # Typical purchase interval
        # -----------------------------------------------------------

        average_purchase_interval = (
            _calculate_average_interval(dates)
        )

        if average_purchase_interval is None:
            average_purchase_interval = 60.0

        # Prevent extremely small intervals from making the model
        # excessively sensitive.
        average_purchase_interval = max(
            average_purchase_interval,
            2.0,
        )

        # -----------------------------------------------------------
        # Recent activity
        # -----------------------------------------------------------

        recent_start = (
            cutoff_date
            - timedelta(days=RECENT_WINDOW_DAYS)
        )

        previous_start = (
            cutoff_date
            - timedelta(
                days=RECENT_WINDOW_DAYS
                + PREVIOUS_WINDOW_DAYS
            )
        )

        recent_orders = sum(
            1
            for date in dates
            if recent_start <= date <= cutoff_date
        )

        previous_orders = sum(
            1
            for date in dates
            if previous_start <= date < recent_start
        )

        frequency_change = (
            recent_orders - previous_orders
        )

        features[customer_id] = {
            "recency_days": recency_days,
            "total_orders": total_orders,
            "total_spent": total_spent,
            "average_order_value": average_order_value,
            "monthly_order_frequency": monthly_order_frequency,
            "average_purchase_interval": average_purchase_interval,
            "recent_orders": recent_orders,
            "previous_orders": previous_orders,
            "frequency_change": frequency_change,
        }

    return features


# -------------------------------------------------------------------
# Historical training data
# -------------------------------------------------------------------

def _build_training_data(sales):
    """
    Build historical customer snapshots.

    A snapshot is labelled:

        1 = customer did not purchase in the next 60 days
        0 = customer purchased again within the next 60 days

    Training focuses on the most recent continuous business period
    rather than mixing unrelated historical eras.
    """

    if not sales:
        return (
            pd.DataFrame(),
            pd.Series(dtype=int),
        )

    latest_date = max(
        sale["sale_date"]
        for sale in sales
    )

    earliest_training_date = (
        latest_date
        - timedelta(days=RECENT_TRAINING_DAYS)
    )

    # Use only recent sales for training.
    recent_sales = [
        sale
        for sale in sales
        if sale["sale_date"] >= earliest_training_date
    ]

    if not recent_sales:
        return (
            pd.DataFrame(),
            pd.Series(dtype=int),
        )

    training_latest_date = max(
        sale["sale_date"]
        for sale in recent_sales
    )

    training_end = (
        training_latest_date
        - timedelta(days=CHURN_WINDOW_DAYS)
    )

    if training_end <= earliest_training_date:
        return (
            pd.DataFrame(),
            pd.Series(dtype=int),
        )

    # ---------------------------------------------------------------
    # Customer purchase dates
    # ---------------------------------------------------------------

    customer_dates = defaultdict(list)

    for sale in recent_sales:
        customer_dates[
            sale["customer_id"]
        ].append(
            sale["sale_date"]
        )

    for customer_id in customer_dates:
        customer_dates[customer_id].sort()

    # ---------------------------------------------------------------
    # Use actual historical sale dates as snapshots.
    # ---------------------------------------------------------------

    snapshot_dates = sorted(
        {
            sale["sale_date"]
            for sale in recent_sales
            if sale["sale_date"] <= training_end
        }
    )

    snapshots = []
    labels = []

    for cutoff_date in snapshot_dates:

        feature_map = _build_features(
            recent_sales,
            cutoff_date,
        )

        future_end = (
            cutoff_date
            + timedelta(days=CHURN_WINDOW_DAYS)
        )

        for customer_id, features in feature_map.items():

            # Need meaningful history.
            if features["total_orders"] < MIN_ORDERS_FOR_MODEL:
                continue

            first_purchase = min(
                customer_dates[customer_id]
            )

            history_days = (
                cutoff_date - first_purchase
            ).days

            if history_days < MIN_HISTORY_DAYS:
                continue

            # -------------------------------------------------------
            # Did the customer purchase again?
            # -------------------------------------------------------

            future_purchase = any(
                cutoff_date < purchase_date <= future_end
                for purchase_date in customer_dates[customer_id]
            )

            label = 0 if future_purchase else 1

            snapshots.append(features)
            labels.append(label)

    if not snapshots:
        return (
            pd.DataFrame(),
            pd.Series(dtype=int),
        )

    X = pd.DataFrame(
        snapshots,
        columns=FEATURE_COLUMNS,
    )

    y = pd.Series(labels)

    return X, y


# -------------------------------------------------------------------
# Train model
# -------------------------------------------------------------------

def _train_model(sales):
    """Train Logistic Regression on recent historical behaviour."""

    X, y = _build_training_data(sales)

    if X.empty:
        return None

    if y.nunique() < 2:
        return None

    model = Pipeline(
        [
            (
                "scaler",
                StandardScaler(),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    model.fit(X, y)

    return model


# -------------------------------------------------------------------
# Behaviour-based probability
# -------------------------------------------------------------------

def _behaviour_probability(features):
    """
    Calculate a conservative probability from the customer's
    actual behaviour.

    This is also used as a safety adjustment around the ML model.
    """

    recency = features["recency_days"]

    interval = max(
        features["average_purchase_interval"],
        2.0,
    )

    ratio = recency / interval

    score = 0.05

    # ---------------------------------------------------------------
    # Recency relative to normal behaviour
    # ---------------------------------------------------------------

    if ratio >= 4:
        score += 0.75

    elif ratio >= 3:
        score += 0.60

    elif ratio >= 2:
        score += 0.40

    elif ratio >= 1.5:
        score += 0.20

    elif ratio >= 1:
        score += 0.08

    # ---------------------------------------------------------------
    # Recent activity
    # ---------------------------------------------------------------

    if features["recent_orders"] == 0:
        score += 0.10

    elif features["recent_orders"] >= 3:
        score -= 0.08

    # ---------------------------------------------------------------
    # Frequency change
    # ---------------------------------------------------------------

    if features["frequency_change"] < 0:
        score += 0.12

    elif features["frequency_change"] > 0:
        score -= 0.05

    # ---------------------------------------------------------------
    # Very active customers should not become High risk merely
    # because the ML model is overconfident.
    # ---------------------------------------------------------------

    if (
        recency <= interval
        and features["recent_orders"] > 0
    ):
        score = min(score, 0.25)

    return min(
        max(score, 0.01),
        0.99,
    )


# -------------------------------------------------------------------
# Risk classification
# -------------------------------------------------------------------

def _risk_level(probability):
    if probability >= HIGH_RISK_THRESHOLD:
        return "High"

    if probability >= MEDIUM_RISK_THRESHOLD:
        return "Medium"

    return "Low"


# -------------------------------------------------------------------
# Recommended action
# -------------------------------------------------------------------

def _recommended_action(risk):
    if risk == "High":
        return "Win-back campaign"

    if risk == "Medium":
        return "Retention campaign"

    return "Cross-sell / upsell"


# -------------------------------------------------------------------
# Explainable reason
# -------------------------------------------------------------------

def _build_reason(features, risk):
    recency = features["recency_days"]
    interval = features["average_purchase_interval"]

    recent_orders = features["recent_orders"]
    previous_orders = features["previous_orders"]

    frequency_change = features["frequency_change"]

    # ---------------------------------------------------------------
    # High risk
    # ---------------------------------------------------------------

    if risk == "High":

        if recency > interval * 2:
            return (
                "Customer has been inactive for significantly longer "
                "than their typical purchase interval."
            )

        if recent_orders == 0 and frequency_change < 0:
            return (
                "Customer has no recent purchases and their purchase "
                "frequency has declined."
            )

        if recent_orders == 0:
            return (
                "Customer has no purchases in the most recent "
                "30-day period."
            )

        if frequency_change < 0:
            return (
                "Customer purchase frequency has declined compared "
                "with their previous activity."
            )

        return (
            "Customer behaviour shows several indicators of "
            "reduced engagement."
        )

    # ---------------------------------------------------------------
    # Medium risk
    # ---------------------------------------------------------------

    if risk == "Medium":

        if recency > interval:
            return (
                "Customer has exceeded their typical purchase "
                "interval and may need a retention touchpoint."
            )

        if frequency_change < 0:
            return (
                "Customer purchase frequency has declined "
                "compared with the previous period."
            )

        if recent_orders == 0:
            return (
                "Customer has not purchased recently but still "
                "shows historical engagement."
            )

        return (
            "Customer activity shows moderate signs of "
            "potential churn."
        )

    # ---------------------------------------------------------------
    # Low risk
    # ---------------------------------------------------------------

    if recent_orders > 0:
        return (
            "Customer has recent purchase activity and appears "
            "actively engaged."
        )

    if recency <= interval:
        return (
            "Customer is still within their typical purchase "
            "interval."
        )

    return (
        "Customer currently shows relatively stable "
        "purchasing behaviour."
    )


# -------------------------------------------------------------------
# Main API function
# -------------------------------------------------------------------

def generate_churn_predictions(db):
    """
    Generate churn predictions for all customers.

    Returns:

    {
        "customers_analyzed": 123,
        "rows": [...]
    }
    """

    from .. import models

    customers = (
        db.query(models.Customer)
        .all()
    )

    sales = _load_sales(db)

    if not customers or not sales:
        return {
            "customers_analyzed": 0,
            "rows": [],
        }

    # ---------------------------------------------------------------
    # Train model
    # ---------------------------------------------------------------

    model = _train_model(sales)

    # ---------------------------------------------------------------
    # Latest transaction is our reference "today".
    # ---------------------------------------------------------------

    reference_date = max(
        sale["sale_date"]
        for sale in sales
    )

    feature_map = _build_features(
        sales,
        reference_date,
    )

    rows = []

    # ---------------------------------------------------------------
    # Predict each customer
    # ---------------------------------------------------------------

    for customer in customers:

        features = feature_map.get(
            customer.id
        )

        if not features:
            continue

        behaviour_probability = _behaviour_probability(
            features
        )

        # -----------------------------------------------------------
        # ML probability
        # -----------------------------------------------------------

        if model is not None:

            X = pd.DataFrame(
                [features],
                columns=FEATURE_COLUMNS,
            )

            ml_probability = float(
                model.predict_proba(X)[0][1]
            )

            # Blend ML with behaviour.
            #
            # This prevents the model from completely ignoring the
            # customer's actual recent behaviour.
            probability = (
                0.55 * ml_probability
                + 0.45 * behaviour_probability
            )

        else:
            probability = behaviour_probability

        # -----------------------------------------------------------
        # Important sanity correction
        # -----------------------------------------------------------

        # A customer who is still buying recently and is within
        # their normal purchase interval should never be classified
        # as extremely high risk merely because of model noise.

        interval = max(
            features["average_purchase_interval"],
            2.0,
        )

        if (
            features["recent_orders"] > 0
            and features["recency_days"] <= interval
        ):
            probability = min(
                probability,
                0.30,
            )

        # If the customer has no recent purchase but is only slightly
        # beyond their normal interval, don't exaggerate the risk.
        elif (
            features["recent_orders"] == 0
            and features["recency_days"] <= interval * 1.5
        ):
            probability = min(
                probability,
                0.55,
            )

        probability = round(
            min(
                max(probability, 0.0),
                1.0,
            ),
            3,
        )

        risk = _risk_level(
            probability
        )

        action = _recommended_action(
            risk
        )

        reason = _build_reason(
            features,
            risk,
        )

        rows.append(
            {
                "customer_id": customer.id,
                "customer_name": customer.full_name,

                "churn_probability": probability,

                # Original backend fields
                "churn_risk": risk,
                "recommended_action": action,

                # Frontend-compatible aliases
                "risk_category": risk,
                "recommendation": action,

                "reason": reason,

                "recency_days": (
                    features["recency_days"]
                ),

                "total_orders": (
                    features["total_orders"]
                ),

                "total_spent": round(
                    features["total_spent"],
                    2,
                ),

                "average_order_value": round(
                    features["average_order_value"],
                    2,
                ),

                "average_purchase_interval": round(
                    features["average_purchase_interval"],
                    1,
                ),

                "monthly_order_frequency": round(
                    features["monthly_order_frequency"],
                    3,
                ),

                "recent_orders": (
                    features["recent_orders"]
                ),

                "previous_orders": (
                    features["previous_orders"]
                ),

                "frequency_change": (
                    features["frequency_change"]
                ),
            }
        )

    # Highest risk first
    rows.sort(
        key=lambda row: row["churn_probability"],
        reverse=True,
    )

    return {
        "customers_analyzed": len(rows),
        "rows": rows,
    }