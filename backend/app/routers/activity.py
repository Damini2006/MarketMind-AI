"""Activity Log / Audit Trail router."""

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
    entry = models.Activity(
        business_id=business_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata_json=metadata_json,
        ip_address=ip_address,
    )
    db.add(entry)
    db.flush()
    return entry


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
        db.query(models.Activity, models.User.full_name)
        .join(models.User, models.Activity.user_id == models.User.id, isouter=True)
        .filter(models.Activity.business_id == current_user.business_id)
    )

    if action:
        q = q.filter(models.Activity.action == action)
    if entity_type:
        q = q.filter(models.Activity.entity_type == entity_type)
    if user_id:
        q = q.filter(models.Activity.user_id == user_id)

    total = q.count()
    entries = (
        q.order_by(desc(models.Activity.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for activity, user_name in entries:
        items.append({
            "id": activity.id,
            "user_name": user_name or "System",
            "action": activity.action,
            "entity_type": activity.entity_type,
            "entity_id": activity.entity_id,
            "description": activity.description,
            "metadata_json": activity.metadata_json,
            "ip_address": activity.ip_address,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        })

    return {"items": items, "total": total}


@router.get("/recent")
def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get the most recent activity entries for dashboard widget."""
    entries = (
        db.query(models.Activity, models.User.full_name)
        .join(models.User, models.Activity.user_id == models.User.id, isouter=True)
        .filter(models.Activity.business_id == current_user.business_id)
        .order_by(desc(models.Activity.created_at))
        .limit(limit)
        .all()
    )

    items = []
    for activity, user_name in entries:
        items.append({
            "id": activity.id,
            "user_name": user_name or "System",
            "action": activity.action,
            "entity_type": activity.entity_type,
            "description": activity.description,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        })

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

    # Total activities
    total = db.query(models.Activity).filter(
        models.Activity.business_id == business_id
    ).count()

    # Today
    today = db.query(models.Activity).filter(
        models.Activity.business_id == business_id,
        models.Activity.created_at >= today_start,
    ).count()

    # This week
    this_week = db.query(models.Activity).filter(
        models.Activity.business_id == business_id,
        models.Activity.created_at >= week_start,
    ).count()

    # This month
    this_month = db.query(models.Activity).filter(
        models.Activity.business_id == business_id,
        models.Activity.created_at >= month_start,
    ).count()

    # Active users (distinct user_ids this month)
    from sqlalchemy import func
    active_users = (
        db.query(func.count(func.distinct(models.Activity.user_id)))
        .filter(
            models.Activity.business_id == business_id,
            models.Activity.created_at >= month_start,
        )
        .scalar()
    ) or 0

    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "this_month": this_month,
        "active_users": active_users,
    }


@router.get("/heatmap")
def get_activity_heatmap(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return activity counts per day and per hour for heatmap visualization."""
    business_id = current_user.business_id
    since = dt.datetime.utcnow() - dt.timedelta(days=days)

    entries = (
        db.query(models.Activity)
        .filter(
            models.Activity.business_id == business_id,
            models.Activity.created_at >= since,
        )
        .all()
    )

    # Daily counts
    daily = {}
    hourly = {h: 0 for h in range(24)}
    action_dist = {}
    for e in entries:
        day = e.created_at.strftime("%Y-%m-%d") if e.created_at else None
        if day:
            daily[day] = daily.get(day, 0) + 1
        if e.created_at:
            hourly[e.created_at.hour] = hourly.get(e.created_at.hour, 0) + 1
        action_dist[e.action] = action_dist.get(e.action, 0) + 1

    # Fill missing days
    heatmap = []
    for i in range(days):
        d = (dt.datetime.utcnow() - dt.timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        heatmap.append({"date": d, "count": daily.get(d, 0)})

    return {
        "heatmap": heatmap,
        "hourly": [{"hour": h, "count": hourly.get(h, 0)} for h in range(24)],
        "action_distribution": action_dist,
        "total_entries": len(entries),
    }


@router.get("/users")
def get_activity_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return distinct users who have activity entries."""
    from sqlalchemy import func
    rows = (
        db.query(
            models.Activity.user_id,
            func.max(models.User.full_name).label("name"),
            func.count(models.Activity.id).label("count"),
        )
        .join(models.User, models.Activity.user_id == models.User.id, isouter=True)
        .filter(models.Activity.business_id == current_user.business_id)
        .group_by(models.Activity.user_id)
        .order_by(desc(func.count(models.Activity.id)))
        .all()
    )
    return {
        "users": [
            {"user_id": r.user_id, "name": r.name or "System", "count": r.count}
            for r in rows
        ]
    }
