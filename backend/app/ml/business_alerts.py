"""
Business Rules for Sales and Inventory Alerts

This module handles business-rule based alerts for:
1. Large quantity sales
2. Significant stock depletion

Statistical and ML anomaly detection such as:
- Z-score
- IQR
- Isolation Forest
- Moving Average
- Temporal analysis

are handled separately by the anomaly detection module.
"""

from typing import Optional

from sqlalchemy.orm import Session

from .. import models

# NOTE: This project uses the ``Notification`` model instead of a separate
# ``Alert`` model.  Field mappings applied:
#   alert_type  -> type
#   description -> message
#   priority    -> level
#   is_read     -> read


# ============================================================
# BUSINESS THRESHOLDS
# ============================================================

# A sale with this many or more units is considered a
# large quantity sale from a business perspective.
LARGE_QUANTITY_THRESHOLD = 20

# Percentage of available stock consumed by a single sale
# that should trigger a significant depletion alert.
STOCK_DEPLETION_THRESHOLD = 0.50

# Avoid creating depletion alerts for very small quantities.
# Example: stock = 4 and sale = 2 should not necessarily
# be treated as a major depletion event.
MIN_DEPLETION_QUANTITY = 5


# ============================================================
# ALERT CREATION
# ============================================================

def _create_business_alert(
    db: Session,
    business_id: int,
    title: str,
    description: str,
    priority: str = "high",
) -> Optional[models.Notification]:
    """
    Create a business alert if an equivalent unread alert
    does not already exist.
    """

    existing = (
        db.query(models.Notification)
        .filter(
            models.Notification.business_id == business_id,
            models.Notification.type == "business_rule",
            models.Notification.title == title,
            models.Notification.read == False,  # noqa: E712
        )
        .first()
    )

    if existing:
        return existing

    alert = models.Notification(
        type="business_rule",
        title=title,
        message=description,
        level=priority,
        business_id=business_id,
    )

    db.add(alert)

    return alert


# ============================================================
# LARGE QUANTITY SALE
# ============================================================

def check_large_quantity_sale(
    db: Session,
    product: models.Product,
    quantity_sold: int,
    business_id: int,
) -> Optional[models.Notification]:
    """
    Detect a large quantity sale using a business-defined threshold.

    This is intentionally NOT a statistical anomaly detector.
    Damini's anomaly detection module handles statistical/ML
    detection.
    """

    if quantity_sold < LARGE_QUANTITY_THRESHOLD:
        return None

    priority = "critical" if quantity_sold >= 2 * LARGE_QUANTITY_THRESHOLD else "high"

    title = f"Large Sale Quantity: {product.name}"

    description = (
        f"A sale of {quantity_sold} units was recorded for "
        f"'{product.name}'. The business threshold for a large "
        f"quantity sale is {LARGE_QUANTITY_THRESHOLD} units."
    )

    return _create_business_alert(
        db=db,
        business_id=business_id,
        title=title,
        description=description,
        priority=priority,
    )


# ============================================================
# SIGNIFICANT STOCK DEPLETION
# ============================================================

def check_stock_depletion(
    db: Session,
    product: models.Product,
    stock_before: int,
    quantity_sold: int,
    stock_after: int,
    business_id: int,
) -> Optional[models.Notification]:
    """
    Detect when a single sale consumes a significant portion
    of the available inventory.

    Example:

        Stock before = 50
        Quantity sold = 30
        Stock after = 20

        Depletion = 30 / 50 = 60%

    This generates a business alert.
    """

    if stock_before <= 0:
        return None

    if quantity_sold < MIN_DEPLETION_QUANTITY:
        return None

    depletion_ratio = quantity_sold / stock_before

    if depletion_ratio < STOCK_DEPLETION_THRESHOLD:
        return None

    depletion_percent = round(depletion_ratio * 100, 1)

    if depletion_ratio >= 0.80:
        priority = "critical"
    else:
        priority = "high"

    title = f"Significant Stock Depletion: {product.name}"

    description = (
        f"A sale of {quantity_sold} units reduced the stock of "
        f"'{product.name}' from {stock_before} to {stock_after}. "
        f"This consumed {depletion_percent}% of the available stock."
    )

    return _create_business_alert(
        db=db,
        business_id=business_id,
        title=title,
        description=description,
        priority=priority,
    )


# ============================================================
# COMBINED SALES BUSINESS CHECK
# ============================================================

def check_sale_business_rules(
    db: Session,
    product: models.Product,
    quantity_sold: int,
    stock_before: int,
    stock_after: int,
    business_id: int,
):
    """
    Run all business-rule checks associated with a sale.

    Returns a list of alerts that were created/found.
    """

    alerts = []

    large_sale_alert = check_large_quantity_sale(
        db=db,
        product=product,
        quantity_sold=quantity_sold,
        business_id=business_id,
    )

    if large_sale_alert:
        alerts.append(large_sale_alert)

    depletion_alert = check_stock_depletion(
        db=db,
        product=product,
        stock_before=stock_before,
        quantity_sold=quantity_sold,
        stock_after=stock_after,
        business_id=business_id,
    )

    if depletion_alert:
        alerts.append(depletion_alert)

    return alerts
