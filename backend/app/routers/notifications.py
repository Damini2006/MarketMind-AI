"""Unified in-app notifications.

Notifications are derived from app events that already exist in the data
model — unresolved low-stock inventory alerts, detected sales anomalies, and
overdue invoices. ``_sync_notifications`` runs on every read so notifications
stay in step with the source data (a resolved alert or paid invoice
automatically clears its notification), and each one is idempotent per
source_type + source_id so nothing is duplicated.

For remote databases (Neon) the sync itself is slow (Isolation Forest + a
handful of queries at ~1s each), so reads never wait for it: it is armed at
most once per SYNC_TTL per business and executed on a background thread.
"""
import datetime as dt
import threading
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..cache import get_or_set, invalidate
from ..database import SessionLocal, get_db
from ..deps import get_current_user
from .ai import _detect_outlier_sales, _is_material_outlier

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _ensure(
    db: Session,
    existing_ids: set,
    ntype: str,
    source_id: int,
    title: str,
    message: str,
    level: str,
    link: str,
    created_at: dt.datetime,
    business_id: int,
) -> None:
    """Insert a notification unless its source is already present.

    `existing_ids` is the preloaded set of source_ids for this type (loaded in
    one query by the caller), which avoids a round-trip per notification.
    """
    if source_id in existing_ids:
        return
    existing_ids.add(source_id)  # also guards duplicates within this sync
    db.add(
        models.Notification(
            business_id=business_id,
            type=ntype,
            title=title,
            message=message,
            level=level,
            link=link,
            source_type=ntype,
            source_id=source_id,
            created_at=created_at or dt.datetime.utcnow(),
        )
    )


def _auto_read_resolved(db: Session, business_id: int, ntype: str, resolved_ids) -> None:
    """Mark notifications read once their source event has cleared."""
    resolved_ids = list(resolved_ids)
    if not resolved_ids:
        return
    for n in (
        db.query(models.Notification)
        .filter(
            models.Notification.business_id == business_id,
            models.Notification.type == ntype,
            models.Notification.read == False,  # noqa: E712
            models.Notification.source_id.in_(resolved_ids),
        )
        .all()
    ):
        n.read = True


SYNC_TTL = 60

_sync_gate: dict = {}
_sync_lock = threading.Lock()


def _sync_notifications(db: Session, business_id: int) -> None:
    """Arm the sync (max once per SYNC_TTL per business) and run it async.

    The bell polls unread-count every 30s; running the full sync (Isolation
    Forest over every sale + several queries) on each poll is what made the
    notifications endpoints take ~13s. Reads now return immediately and the
    sync happens on a background thread with its own session, so the bell is
    never blocked by it.
    """
    now = time.time()
    with _sync_lock:
        if now - _sync_gate.get(business_id, 0) < SYNC_TTL:
            return
        _sync_gate[business_id] = now  # arm BEFORE spawning, prevents stampede
    threading.Thread(
        target=_run_sync_in_background, args=(business_id,), daemon=True
    ).start()


def _run_sync_in_background(business_id: int) -> None:
    """Execute the sync in a dedicated session; failures must never surface."""
    db = SessionLocal()
    try:
        _do_sync_notifications(db, business_id)
    except Exception:
        pass
    finally:
        db.close()


def _do_sync_notifications(db: Session, business_id: int) -> None:
    # Preload existing notification source ids per type (one query each)
    # instead of checking existence per notification.
    existing_by_type = {}
    for ntype in ("inventory", "anomaly", "invoice"):
        existing_by_type[ntype] = {
            r[0]
            for r in db.query(models.Notification.source_id)
            .filter(
                models.Notification.business_id == business_id,
                models.Notification.type == ntype,
            )
            .all()
        }

    # 0. Backfill unresolved inventory alerts for products currently low on
    #    stock, so the alerts table stays consistent and feeds notifications.
    low_stock = (
        db.query(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.stock_quantity <= models.Product.reorder_threshold,
        )
        .all()
    )
    unresolved_alerts = {
        a.product_id: a
        for a in db.query(models.InventoryAlert)
        .filter(
            models.InventoryAlert.business_id == business_id,
            models.InventoryAlert.resolved == False,  # noqa: E712
        )
        .all()
    }
    for p in low_stock:
        if p.id not in unresolved_alerts:
            level = "critical" if p.stock_quantity == 0 else "warning"
            db.add(
                models.InventoryAlert(
                    product_id=p.id,
                    message=f"'{p.name}' stock is low ({p.stock_quantity} left, reorder threshold {p.reorder_threshold}).",
                    level=level,
                    business_id=business_id,
                )
            )

    # 1. Unresolved low-stock inventory alerts
    alerts = (
        db.query(models.InventoryAlert)
        .filter(
            models.InventoryAlert.business_id == business_id,
            models.InventoryAlert.resolved == False,  # noqa: E712
        )
        .all()
    )
    for a in alerts:
        _ensure(
            db, existing_by_type["inventory"], "inventory", a.id,
            "Low stock", a.message, a.level, "/inventory", a.created_at,
            business_id,
        )
    _auto_read_resolved(
        db, business_id, "inventory",
        [
            r[0]
            for r in db.query(models.InventoryAlert.id)
            .filter(
                models.InventoryAlert.business_id == business_id,
                models.InventoryAlert.resolved == True,  # noqa: E712
            )
            .all()
        ],
    )

    # 2. Detected sales anomalies (same Isolation Forest as the AI scan;
    #    only material outliers surface in the bell so it stays actionable)
    outliers = [
        s
        for s in _detect_outlier_sales(
            db.query(models.Sale)
            .filter(models.Sale.business_id == business_id)
            .all()
        )
        if _is_material_outlier(s)
    ]
    for s in outliers:
        _ensure(
            db, existing_by_type["anomaly"], "anomaly", s.id,
            "Unusual activity",
            f"Unusual bulk order detected: {s.quantity} units totaling ₹{s.total_amount:,.2f}.",
            "high",
            "/anomalies",
            s.sale_date or dt.datetime.utcnow(),
            business_id,
        )

    # 3. Overdue invoices (status "overdue", or pending and past due date)
    now = dt.datetime.utcnow()
    overdue = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.business_id == business_id,
            models.Invoice.status != "paid",
            models.Invoice.due_date.isnot(None),
            models.Invoice.due_date < now,
        )
        .all()
    )
    overdue += (
        db.query(models.Invoice)
        .filter(
            models.Invoice.business_id == business_id,
            models.Invoice.status == "overdue",
        )
        .all()
    )
    for inv in overdue:
        _ensure(
            db, existing_by_type["invoice"], "invoice", inv.id,
            "Invoice overdue",
            f"Invoice {inv.invoice_number} for ₹{inv.amount:,.2f} is past its due date.",
            "warning",
            "/invoices",
            inv.due_date,
            business_id,
        )
    _auto_read_resolved(
        db, business_id, "invoice",
        [
            r[0]
            for r in db.query(models.Invoice.id)
            .filter(
                models.Invoice.business_id == business_id,
                models.Invoice.status == "paid",
            )
            .all()
        ],
    )

    db.commit()


def _read_notifications(db: Session, business_id: int) -> dict:
    """Build the list response as plain dicts (cacheable) + unread count."""
    items = (
        db.query(models.Notification)
        .filter(models.Notification.business_id == business_id)
        .order_by(
            models.Notification.read.asc(),
            models.Notification.created_at.desc(),
        )
        .limit(50)
        .all()
    )
    unread = (
        db.query(models.Notification)
        .filter(
            models.Notification.business_id == business_id,
            models.Notification.read == False,  # noqa: E712
        )
        .count()
    )
    return {
        "items": [
            schemas.NotificationOut.model_validate(i).model_dump(mode="json")
            for i in items
        ],
        "unread_count": unread,
    }


# Reads are cached for the bell's own poll interval (30s): every poll then
# hits the cache instead of paying two Neon round-trips (~2s). mark-read /
# read-all invalidate the cache so the badge still updates instantly.
READ_TTL = 30


@router.get("", response_model=schemas.NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    bid = current_user.business_id
    _sync_notifications(db, bid)
    return get_or_set(f"notif:{bid}:list", READ_TTL, lambda: _read_notifications(db, bid))


@router.get("/unread-count", response_model=schemas.UnreadCountResponse)
def unread_count(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    bid = current_user.business_id
    _sync_notifications(db, bid)
    return get_or_set(
        f"notif:{bid}:unread",
        READ_TTL,
        lambda: {"unread_count": _read_notifications(db, bid)["unread_count"]},
    )


@router.post("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    n = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.business_id == current_user.business_id,
        )
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    db.commit()
    invalidate(f"notif:{current_user.business_id}")
    db.refresh(n)
    return n


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    (
        db.query(models.Notification)
        .filter(
            models.Notification.business_id == current_user.business_id,
            models.Notification.read == False,  # noqa: E712
        )
        .update({"read": True})
    )
    db.commit()
    invalidate(f"notif:{current_user.business_id}")
    return {"status": "ok"}
