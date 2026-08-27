from datetime import datetime
from typing import Dict, Any

from sqlalchemy.orm import Session

from .. import models


def calculate_churn_risk(db: Session) -> Dict[str, Any]:
    """
    Calculate explainable customer churn risk using:
    - Recency
    - Purchase frequency
    - Monetary value
    - Inactivity

    Returns customer-level churn information that can later
    be consumed by the recommendation engine.
    """

    customers = db.query(models.Customer).all()

    if not customers:
        return {
            "customers": [],
            "summary": {
                "total_customers": 0,
                "high_risk": 0,
                "medium_risk": 0,
                "low_risk": 0,
            },
        }

    now = datetime.utcnow()

    customer_data = []

    # Collect purchase statistics
    for customer in customers:

        sales = (
            db.query(models.Sale)
            .filter(models.Sale.customer_id == customer.id)
            .order_by(models.Sale.sale_date.asc())
            .all()
        )

        if not sales:
            customer_data.append(
                {
                    "customer_id": customer.id,
                    "customer_name": customer.full_name,
                    "recency_days": 999,
                    "frequency": 0,
                    "monetary": 0.0,
                    "churn_probability": 1.0,
                    "risk_category": "High",
                }
            )
            continue

        last_sale = sales[-1]

        if last_sale.sale_date:
            sale_date = last_sale.sale_date

            # Handle timezone-aware / naive datetime safely.
            if sale_date.tzinfo is not None and now.tzinfo is None:
                now_for_calc = now.replace(tzinfo=sale_date.tzinfo)
            else:
                now_for_calc = now

            recency_days = max(
                0,
                (now_for_calc - sale_date).days,
            )
        else:
            recency_days = 999

        frequency = len(sales)

        monetary = sum(
            float(s.total_amount or 0)
            for s in sales
        )

        customer_data.append(
            {
                "customer_id": customer.id,
                "customer_name": customer.full_name,
                "recency_days": recency_days,
                "frequency": frequency,
                "monetary": monetary,
            }
        )

    # Normalization helpers
    max_frequency = max(
        (c["frequency"] for c in customer_data),
        default=1,
    )

    max_monetary = max(
        (c["monetary"] for c in customer_data),
        default=1.0,
    )

    # Prevent division by zero.
    max_frequency = max(max_frequency, 1)
    max_monetary = max(max_monetary, 1.0)

    results = []

    for customer in customer_data:

        recency = customer["recency_days"]
        frequency = customer["frequency"]
        monetary = customer["monetary"]

        # Recency risk:
        # Recent customers have low risk.
        # Long-inactive customers have high risk.
        recency_score = min(recency / 90.0, 1.0)

        # Frequency risk:
        # Frequent purchasers are less likely to churn.
        frequency_score = 1.0 - min(
            frequency / max_frequency,
            1.0,
        )

        # Monetary risk:
        # Higher-value customers receive lower churn risk.
        monetary_score = 1.0 - min(
            monetary / max_monetary,
            1.0,
        )

        # Weighted churn score.
        churn_probability = (
            recency_score * 0.50
            + frequency_score * 0.25
            + monetary_score * 0.25
        )

        churn_probability = round(
            min(max(churn_probability, 0.0), 1.0),
            3,
        )

        if churn_probability >= 0.70:
            risk_category = "High"
        elif churn_probability >= 0.40:
            risk_category = "Medium"
        else:
            risk_category = "Low"

        results.append(
            {
                **customer,
                "churn_probability": churn_probability,
                "risk_category": risk_category,
            }
        )

    high = sum(
        1 for c in results
        if c["risk_category"] == "High"
    )

    medium = sum(
        1 for c in results
        if c["risk_category"] == "Medium"
    )

    low = sum(
        1 for c in results
        if c["risk_category"] == "Low"
    )

    return {
        "customers": results,
        "summary": {
            "total_customers": len(results),
            "high_risk": high,
            "medium_risk": medium,
            "low_risk": low,
        },
    }