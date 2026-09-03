"""
Business Rule → Anomaly Alert Bridge
=====================================
Reads business-rule notifications from the Notification table and converts
them into the anomaly alert dictionary format expected by the frontend's
Anomaly Alerts page, so both statistical/ML anomalies and business-rule
alerts appear together.
"""

import datetime as dt
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from .. import models


def get_business_rule_alerts(
    db: Session,
    business_id: int,
) -> List[Dict[str, Any]]:
    """
    Query all business-rule notifications and return them in the same
    dictionary format that the anomaly detection pipeline produces.
    """
    alerts = (
        db.query(models.Notification)
        .filter(
            models.Notification.business_id == business_id,
            models.Notification.type == "business_rule",
        )
        .order_by(models.Notification.created_at.desc())
        .all()
    )

    results: List[Dict[str, Any]] = []

    for alert in alerts:
        title = alert.title or "Business Rule Alert"
        message = alert.message or ""

        # Map priority → severity
        severity_map = {"critical": "high", "high": "high", "medium": "medium", "low": "low"}
        severity = severity_map.get(alert.level or "medium", "medium")

        # Infer anomaly_type from title
        if "Large Sale" in title:
            anomaly_type = "large_quantity_sale"
            category = "sales"
            suggested_action = (
                "Verify this bulk sale is legitimate. Large quantity "
                "sales should be approved by a manager."
            )
        elif "Depletion" in title:
            anomaly_type = "stock_depletion"
            category = "inventory"
            suggested_action = (
                "Reorder this product immediately — significant "
                "inventory was consumed by a single transaction."
            )
        else:
            anomaly_type = "business_rule"
            category = "sales"
            suggested_action = "Review this business rule alert."

        results.append({
            "id": alert.id,
            "category": category,
            "severity": severity,
            "anomaly_type": anomaly_type,
            "confidence": 0.95,
            "description": f"[Business Rule] {title}: {message}",
            "details": {
                "notification_id": alert.id,
                "notification_title": title,
                "priority": alert.level,
                "read": alert.read,
                "source": "business_rules",
            },
            "created_at": (
                alert.created_at.isoformat()
                if alert.created_at
                else dt.datetime.utcnow().isoformat()
            ),
            "suggested_action": suggested_action,
            "affected_entity": title,
            "trend": "isolated",
        })

    return results
