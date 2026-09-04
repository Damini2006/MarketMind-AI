"""Activity Log router — queries the audit_logs table."""

import datetime as dt
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(
    prefix="/api/activity",
    tags=["Activity Log"],
)


def log_activity(
    db: Session,
    business_id: int,
    user_id: int,
    action: str,
    description: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    metadata_json: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    """Helper to create an activity log entry. Call from other routers."""
    entry = models.AuditLog(
        business_id=business_id,
        user_id=user_id,
        action=action,
        action_type=entity_type or "info",
        resource=entity_type,
        resource_id=entity_id,
        details=description,
        ip_address=ip_address,
    )
    db.add(entry)
    db.flush()
    return entry


def _serialize(activity, user_name):
    """Serialize an AuditLog row for the API."""
    return {
        "id": activity.id,
        "user_name": user_name or "System",
        "action": activity.action,
        "entity_type": getattr(activity, "resource", None) or getattr(activity, "action_type", ""),
        "entity_id": getattr(activity, "resource_id", None),
        "description": getattr(activity, "details", ""),
        "ip_address": getattr(activity, "ip_address", None),
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
    }


@router.get("/log")
def get_activity_log(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List activity log entries for the current user's business."""
    q = (
        db.query(models.AuditLog, models.User.full_name)
        .join(models.User, models.AuditLog.user_id == models.User.id, isouter=True)
        .filter(models.AuditLog.business_id == current_user.business_id)
    )

    if action:
        q = q.filter(models.AuditLog.action == action)
    if entity_type:
        q = q.filter(models.AuditLog.resource == entity_type)
    if user_id:
        q = q.filter(models.AuditLog.user_id == user_id)

    total = q.count()
    entries = (
        q.order_by(desc(models.AuditLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [_serialize(a, un) for a, un in entries]
    return {"items": items, "total": total}


@router.get("/recent")
def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get the most recent activity entries for dashboard widget."""
    entries = (
        db.query(models.AuditLog, models.User.full_name)
        .join(models.User, models.AuditLog.user_id == models.User.id, isouter=True)
        .filter(models.AuditLog.business_id == current_user.business_id)
        .order_by(desc(models.AuditLog.created_at))
        .limit(limit)
        .all()
    )

    items = [_serialize(a, un) for a, un in entries]
    return {"items": items}


@router.get("/stats")
def get_activity_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get activity statistics for the dashboard."""
    business_id = current_user.business_id
    now = dt.datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - dt.timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    total = db.query(models.AuditLog).filter(
        models.AuditLog.business_id == business_id
    ).count()
    today = db.query(models.AuditLog).filter(
        models.AuditLog.business_id == business_id,
        models.AuditLog.created_at >= today_start,
    ).count()
    this_week = db.query(models.AuditLog).filter(
        models.AuditLog.business_id == business_id,
        models.AuditLog.created_at >= week_start,
    ).count()
    this_month = db.query(models.AuditLog).filter(
        models.AuditLog.business_id == business_id,
        models.AuditLog.created_at >= month_start,
    ).count()
    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "this_month": this_month,
    }


@router.get("/heatmap")
def get_activity_heatmap(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get activity heatmap data (hour × day counts)."""
    business_id = current_user.business_id
    since = dt.datetime.utcnow() - dt.timedelta(days=days)
    entries = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.business_id == business_id, models.AuditLog.created_at >= since)
        .all()
    )
    heatmap = {}
    for e in entries:
        if e.created_at:
            key = f"{e.created_at.weekday()}_{e.created_at.hour}"
            heatmap[key] = heatmap.get(key, 0) + 1
    return {"heatmap": heatmap, "days": days}


@router.get("/users")
def get_activity_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get activity counts per user."""
    business_id = current_user.business_id
    entries = (
        db.query(models.User.full_name, models.AuditLog.id)
        .join(models.AuditLog, models.AuditLog.user_id == models.User.id)
        .filter(models.AuditLog.business_id == business_id)
        .all()
    )
    user_counts = {}
    for name, _ in entries:
        user_counts[name] = user_counts.get(name, 0) + 1
    return {"users": user_counts}
