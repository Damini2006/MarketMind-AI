"""Audit Trail API — logs user actions for compliance and security."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


def log_action(
    db: Session,
    action: str,
    action_type: str,
    resource: str = None,
    resource_id: int = None,
    user_id: int = None,
    user_name: str = None,
    business_id: int = None,
    ip_address: str = None,
    user_agent: str = None,
    device: str = None,
    location: str = None,
    latitude: float = None,
    longitude: float = None,
    is_suspicious: bool = None,
    suspicion_reason: str = None,
    details: str = None,
):
    """Helper to create an audit log entry."""
    entry = AuditLog(
        business_id=business_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        action_type=action_type,
        resource=resource,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        device=device,
        location=location,
        latitude=latitude,
        longitude=longitude,
        is_suspicious=is_suspicious,
        suspicion_reason=suspicion_reason,
        details=details,
    )
    db.add(entry)
    db.commit()
    return entry


@router.get("/logs")
def get_audit_logs(
    request: Request,
    search: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return audit logs for the current business, newest first."""
    from ..cache import get_or_set

    # Always scope to the caller's own business (never trust the query param
    # alone — that let any authenticated user read every business's trail).
    business_id = current_user.business_id

    def _load():
        query = db.query(AuditLog)
        if business_id:
            query = query.filter(AuditLog.business_id == int(business_id))

        if search:
            like = f"%{search}%"
            query = query.filter(
                AuditLog.user_name.ilike(like)
                | AuditLog.action.ilike(like)
                | AuditLog.resource.ilike(like)
                | AuditLog.details.ilike(like)
            )

        if action_type and action_type != "all":
            query = query.filter(AuditLog.action_type == action_type)

        logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()

        return [
            {
                "id": log.id,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "user": log.user_name or "System",
                "action": log.action,
                "action_type": log.action_type,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address or "—",
                "device": log.device or "—",
                "location": log.location or "—",
                "latitude": log.latitude,
                "longitude": log.longitude,
                "is_suspicious": bool(log.is_suspicious),
                "suspicion_reason": log.suspicion_reason or "",
                "details": log.details or "",
            }
            for log in logs
        ]

    return get_or_set(
        f"audit_logs:{business_id}:{search or ''}:{action_type or ''}:{limit}",
        30,
        _load,
    )


@router.post("/logs")
def create_audit_log(
    request: Request,
    action: str,
    action_type: str,
    resource: str = None,
    resource_id: int = None,
    details: str = None,
    db: Session = Depends(get_db),
):
    """Manually create an audit log entry."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")
    user = getattr(request.state, "user", None)

    entry = log_action(
        db=db,
        action=action,
        action_type=action_type,
        resource=resource,
        resource_id=resource_id,
        user_id=getattr(user, "id", None),
        user_name=getattr(user, "full_name", None),
        business_id=getattr(user, "business_id", None),
        ip_address=ip,
        user_agent=ua,
        details=details,
    )
    return {"id": entry.id, "status": "created"}


@router.get("/stats")
def get_audit_stats(
    request: Request,
    db: Session = Depends(get_db),
):
    """Return audit statistics for the current business."""
    business_id = request.query_params.get("business_id")
    user = getattr(request.state, "user", None)
    if not business_id and user:
        business_id = getattr(user, "business_id", None)

    query = db.query(AuditLog)
    if business_id:
        query = query.filter(AuditLog.business_id == int(business_id))

    total = query.count()

    # Action type breakdown
    from sqlalchemy import func
    type_counts = (
        db.query(AuditLog.action_type, func.count(AuditLog.id))
        .group_by(AuditLog.action_type)
    )
    if business_id:
        type_counts = type_counts.filter(AuditLog.business_id == int(business_id))
    type_counts = type_counts.all()

    # Last 24h activity
    yesterday = datetime.utcnow() - timedelta(hours=24)
    recent = query.filter(AuditLog.created_at >= yesterday).count()

    return {
        "total": total,
        "recent_24h": recent,
        "by_type": {t: c for t, c in type_counts},
    }
