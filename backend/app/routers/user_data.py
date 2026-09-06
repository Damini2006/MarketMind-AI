"""User data CRUD — stores scheduled reports, dashboard layouts,
report templates, and prediction history in Neon PostgreSQL.

Every endpoint is scoped to the authenticated user's own business
(multi-tenant safe) — no cross-business reads or writes are possible.
"""
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import (
    ScheduledReport, DashboardLayout, CustomReportTemplate, PredictionHistory, ChatHistory,
)

router = APIRouter(prefix="/api/user-data", tags=["user-data"])


# ── Pydantic schemas ──────────────────────────────────────────────────
class ScheduledReportIn(BaseModel):
    report_type: str
    frequency: str = "weekly"
    format: str = "pdf"
    recipients: List[str] = []
    enabled: bool = True

class DashboardLayoutIn(BaseModel):
    name: str
    layout_json: str  # JSON string of grid layout
    is_active: bool = False

class ReportTemplateIn(BaseModel):
    name: str
    description: str = ""
    sections: str  # JSON string of section configs

class PredictionHistoryIn(BaseModel):
    predicted_revenue: float
    actual_revenue: Optional[float] = None
    horizon_days: int = 30

class ChatHistoryIn(BaseModel):
    messages: str  # JSON string of messages array


# ══════════════════════════════════════════════════════════════════════
#  SCHEDULED REPORTS
# ══════════════════════════════════════════════════════════════════════
@router.get("/scheduled-reports")
def list_scheduled_reports(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    bid = current_user.business_id
    items = (
        db.query(ScheduledReport)
        .filter(ScheduledReport.business_id == bid)
        .order_by(desc(ScheduledReport.created_at))
        .all()
    )
    return [{
        "id": r.id,
        "report_type": r.report_type,
        "frequency": r.frequency,
        "format": r.format,
        "recipients": json.loads(r.recipients) if r.recipients else [],
        "enabled": r.enabled,
        "last_run": r.last_run.isoformat() if r.last_run else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in items]


@router.post("/scheduled-reports")
def create_scheduled_report(
    body: ScheduledReportIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = ScheduledReport(
        business_id=current_user.business_id,
        report_type=body.report_type,
        frequency=body.frequency,
        format=body.format,
        recipients=json.dumps(body.recipients),
        enabled=body.enabled,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id, "status": "created"}


@router.put("/scheduled-reports/{report_id}")
def update_scheduled_report(
    report_id: int,
    body: ScheduledReportIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = (
        db.query(ScheduledReport)
        .filter(
            ScheduledReport.id == report_id,
            ScheduledReport.business_id == current_user.business_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    r.report_type = body.report_type
    r.frequency = body.frequency
    r.format = body.format
    r.recipients = json.dumps(body.recipients)
    r.enabled = body.enabled
    db.commit()
    return {"status": "updated"}


@router.delete("/scheduled-reports/{report_id}")
def delete_scheduled_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = (
        db.query(ScheduledReport)
        .filter(
            ScheduledReport.id == report_id,
            ScheduledReport.business_id == current_user.business_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    db.delete(r)
    db.commit()
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════
#  DASHBOARD LAYOUTS
# ══════════════════════════════════════════════════════════════════════
@router.get("/dashboard-layouts")
def list_dashboard_layouts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from ..cache import get_or_set

    bid = current_user.business_id

    def _load():
        items = (
            db.query(DashboardLayout)
            .filter(DashboardLayout.business_id == bid)
            .order_by(desc(DashboardLayout.updated_at))
            .all()
        )
        return [{
            "id": d.id,
            "name": d.name,
            "layout_json": d.layout_json,
            "is_active": d.is_active,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        } for d in items]

    return get_or_set(f"user_data_layouts:{bid}", 30, _load)


@router.post("/dashboard-layouts")
def create_dashboard_layout(
    body: DashboardLayoutIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    d = DashboardLayout(
        business_id=current_user.business_id, user_id=current_user.id,
        name=body.name, layout_json=body.layout_json,
        is_active=body.is_active,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    from ..cache import invalidate
    invalidate(f"user_data_layouts:{current_user.business_id}")
    return {"id": d.id, "status": "created"}


@router.put("/dashboard-layouts/{layout_id}")
def update_dashboard_layout(
    layout_id: int,
    body: DashboardLayoutIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    d = (
        db.query(DashboardLayout)
        .filter(
            DashboardLayout.id == layout_id,
            DashboardLayout.business_id == current_user.business_id,
        )
        .first()
    )
    if not d:
        raise HTTPException(404, "Layout not found")
    d.name = body.name
    d.layout_json = body.layout_json
    d.is_active = body.is_active
    db.commit()
    from ..cache import invalidate
    invalidate(f"user_data_layouts:{current_user.business_id}")
    return {"status": "updated"}


@router.delete("/dashboard-layouts/{layout_id}")
def delete_dashboard_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    d = (
        db.query(DashboardLayout)
        .filter(
            DashboardLayout.id == layout_id,
            DashboardLayout.business_id == current_user.business_id,
        )
        .first()
    )
    if not d:
        raise HTTPException(404, "Layout not found")
    db.delete(d)
    db.commit()
    from ..cache import invalidate
    invalidate(f"user_data_layouts:{current_user.business_id}")
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════
#  REPORT TEMPLATES
# ══════════════════════════════════════════════════════════════════════
@router.get("/report-templates")
def list_report_templates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    bid = current_user.business_id
    items = (
        db.query(CustomReportTemplate)
        .filter(CustomReportTemplate.business_id == bid)
        .order_by(desc(CustomReportTemplate.updated_at))
        .all()
    )
    return [{
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "sections": json.loads(t.sections) if t.sections else [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    } for t in items]


@router.post("/report-templates")
def create_report_template(
    body: ReportTemplateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = CustomReportTemplate(
        business_id=current_user.business_id,
        name=body.name, description=body.description,
        sections=body.sections,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "status": "created"}


@router.put("/report-templates/{template_id}")
def update_report_template(
    template_id: int,
    body: ReportTemplateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = (
        db.query(CustomReportTemplate)
        .filter(
            CustomReportTemplate.id == template_id,
            CustomReportTemplate.business_id == current_user.business_id,
        )
        .first()
    )
    if not t:
        raise HTTPException(404, "Template not found")
    t.name = body.name
    t.description = body.description
    t.sections = body.sections
    db.commit()
    return {"status": "updated"}


@router.delete("/report-templates/{template_id}")
def delete_report_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = (
        db.query(CustomReportTemplate)
        .filter(
            CustomReportTemplate.id == template_id,
            CustomReportTemplate.business_id == current_user.business_id,
        )
        .first()
    )
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════
#  PREDICTION HISTORY
# ══════════════════════════════════════════════════════════════════════
@router.get("/prediction-history")
def list_prediction_history(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    bid = current_user.business_id
    items = (
        db.query(PredictionHistory)
        .filter(PredictionHistory.business_id == bid)
        .order_by(desc(PredictionHistory.created_at))
        .limit(limit)
        .all()
    )
    return [{
        "id": p.id,
        "predicted_revenue": p.predicted_revenue,
        "actual_revenue": p.actual_revenue,
        "horizon_days": p.horizon_days,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in items]


@router.post("/prediction-history")
def create_prediction(
    body: PredictionHistoryIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    p = PredictionHistory(
        business_id=current_user.business_id,
        predicted_revenue=body.predicted_revenue,
        actual_revenue=body.actual_revenue,
        horizon_days=body.horizon_days,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "status": "created"}


# ══════════════════════════════════════════════════════════════════════
#  CHAT HISTORY
# ══════════════════════════════════════════════════════════════════════
@router.get("/chat-history")
def get_chat_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(desc(ChatHistory.updated_at))
        .first()
    )
    if not item:
        return {"messages": []}
    return {"messages": item.messages_json, "id": item.id}


@router.post("/chat-history")
def save_chat_history(
    body: ChatHistoryIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(desc(ChatHistory.updated_at))
        .first()
    )
    if existing:
        existing.messages_json = body.messages
    else:
        db.add(
            ChatHistory(
                user_id=current_user.id,
                business_id=current_user.business_id,
                messages_json=body.messages,
            )
        )
    db.commit()
    return {"status": "saved"}


@router.delete("/chat-history")
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
    db.commit()
    return {"status": "cleared"}