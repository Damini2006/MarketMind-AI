"""User data CRUD — stores scheduled reports, dashboard layouts,
report templates, and prediction history in Neon PostgreSQL."""
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    ScheduledReport, DashboardLayout, CustomReportTemplate, PredictionHistory, ChatHistory,
)

router = APIRouter(prefix="/api/user-data", tags=["user-data"])


def _get_bid(request: Request) -> Optional[int]:
    user = getattr(request.state, "user", None)
    return getattr(user, "business_id", None)


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


# ══════════════════════════════════════════════════════════════════════
#  SCHEDULED REPORTS
# ══════════════════════════════════════════════════════════════════════
@router.get("/scheduled-reports")
def list_scheduled_reports(request: Request, db: Session = Depends(get_db)):
    bid = _get_bid(request)
    q = db.query(ScheduledReport)
    if bid:
        q = q.filter(ScheduledReport.business_id == bid)
    items = q.order_by(desc(ScheduledReport.created_at)).all()
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
    request: Request,
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    r = ScheduledReport(
        business_id=bid,
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
    request: Request,
    db: Session = Depends(get_db),
):
    r = db.query(ScheduledReport).get(report_id)
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
def delete_scheduled_report(report_id: int, db: Session = Depends(get_db)):
    r = db.query(ScheduledReport).get(report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    db.delete(r)
    db.commit()
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════
#  DASHBOARD LAYOUTS
# ══════════════════════════════════════════════════════════════════════
@router.get("/dashboard-layouts")
def list_dashboard_layouts(request: Request, db: Session = Depends(get_db)):
    bid = _get_bid(request)
    q = db.query(DashboardLayout)
    if bid:
        q = q.filter(DashboardLayout.business_id == bid)
    items = q.order_by(desc(DashboardLayout.updated_at)).all()
    return [{
        "id": d.id,
        "name": d.name,
        "layout_json": d.layout_json,
        "is_active": d.is_active,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    } for d in items]


@router.post("/dashboard-layouts")
def create_dashboard_layout(
    body: DashboardLayoutIn,
    request: Request,
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    uid = getattr(getattr(request.state, "user", None), "id", None)
    d = DashboardLayout(
        business_id=bid, user_id=uid,
        name=body.name, layout_json=body.layout_json,
        is_active=body.is_active,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"id": d.id, "status": "created"}


@router.put("/dashboard-layouts/{layout_id}")
def update_dashboard_layout(
    layout_id: int,
    body: DashboardLayoutIn,
    db: Session = Depends(get_db),
):
    d = db.query(DashboardLayout).get(layout_id)
    if not d:
        raise HTTPException(404, "Layout not found")
    d.name = body.name
    d.layout_json = body.layout_json
    d.is_active = body.is_active
    db.commit()
    return {"status": "updated"}


@router.delete("/dashboard-layouts/{layout_id}")
def delete_dashboard_layout(layout_id: int, db: Session = Depends(get_db)):
    d = db.query(DashboardLayout).get(layout_id)
    if not d:
        raise HTTPException(404, "Layout not found")
    db.delete(d)
    db.commit()
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════════════
#  REPORT TEMPLATES
# ══════════════════════════════════════════════════════════════════════
@router.get("/report-templates")
def list_report_templates(request: Request, db: Session = Depends(get_db)):
    bid = _get_bid(request)
    q = db.query(CustomReportTemplate)
    if bid:
        q = q.filter(CustomReportTemplate.business_id == bid)
    items = q.order_by(desc(CustomReportTemplate.updated_at)).all()
    return [{
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "sections": t.sections,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    } for t in items]


@router.post("/report-templates")
def create_report_template(
    body: ReportTemplateIn,
    request: Request,
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    t = CustomReportTemplate(
        business_id=bid,
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
):
    t = db.query(CustomReportTemplate).get(template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    t.name = body.name
    t.description = body.description
    t.sections = body.sections
    db.commit()
    return {"status": "updated"}


@router.delete("/report-templates/{template_id}")
def delete_report_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(CustomReportTemplate).get(template_id)
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
    request: Request,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    q = db.query(PredictionHistory)
    if bid:
        q = q.filter(PredictionHistory.business_id == bid)
    items = q.order_by(desc(PredictionHistory.created_at)).limit(limit).all()
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
    request: Request,
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    p = PredictionHistory(
        business_id=bid,
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
class ChatHistoryIn(BaseModel):
    messages: str  # JSON string of messages array


@router.get("/chat-history")
def get_chat_history(request: Request, db: Session = Depends(get_db)):
    bid = _get_bid(request)
    uid = getattr(getattr(request.state, "user", None), "id", None)
    q = db.query(ChatHistory)
    if uid:
        q = q.filter(ChatHistory.user_id == uid)
    elif bid:
        q = q.filter(ChatHistory.business_id == bid)
    item = q.order_by(desc(ChatHistory.updated_at)).first()
    if not item:
        return {"messages": []}
    return {"messages": item.messages_json, "id": item.id}


@router.post("/chat-history")
def save_chat_history(
    body: ChatHistoryIn,
    request: Request,
    db: Session = Depends(get_db),
):
    bid = _get_bid(request)
    uid = getattr(getattr(request.state, "user", None), "id", None)
    # Upsert: find existing or create new
    q = db.query(ChatHistory)
    if uid:
        q = q.filter(ChatHistory.user_id == uid)
    existing = q.order_by(desc(ChatHistory.updated_at)).first()
    if existing:
        existing.messages_json = body.messages
    else:
        existing = ChatHistory(
            business_id=bid, user_id=uid,
            messages_json=body.messages,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {"id": existing.id, "status": "saved"}


@router.delete("/chat-history")
def clear_chat_history(request: Request, db: Session = Depends(get_db)):
    uid = getattr(getattr(request.state, "user", None), "id", None)
    if uid:
        db.query(ChatHistory).filter(ChatHistory.user_id == uid).delete()
    db.commit()
    return {"status": "cleared"}
