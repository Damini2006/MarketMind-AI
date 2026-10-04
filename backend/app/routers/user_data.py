"""User data CRUD — stores scheduled reports, dashboard layouts,
report templates, and prediction history in Neon PostgreSQL.

Every endpoint is scoped to the authenticated user's own business
(multi-tenant safe) — no cross-business reads or writes are possible.
"""
import datetime as dt
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
    ReportRun,
)

router = APIRouter(prefix="/api/user-data", tags=["user-data"])


# ── Schedule helpers ──────────────────────────────────────────────
def _compute_next_run(frequency: str, last_run: Optional[dt.datetime],
                      now: Optional[dt.datetime] = None) -> Optional[dt.datetime]:
    """Next 9:00 AM local run time for a daily/weekly/monthly schedule.

    "Weekly" fires on Mondays and "monthly" on the 1st (matching the UI
    copy). Both the last-run check and the next-run computation use the
    same local "now", so the next occurrence is always strictly in the
    future — previously the frontend showed a hardcoded null.
    """
    now = now or dt.datetime.now()
    nine_am = now.replace(hour=9, minute=0, second=0, microsecond=0)

    if frequency == "daily":
        candidate = nine_am if now.hour < 9 else nine_am + dt.timedelta(days=1)
    elif frequency == "weekly":
        days_until_monday = (7 - now.weekday()) % 7  # Monday == 0
        candidate = nine_am + dt.timedelta(days=days_until_monday)
        if candidate <= now:
            candidate += dt.timedelta(days=7)
    elif frequency == "monthly":
        candidate = (now.replace(day=28) + dt.timedelta(days=4)).replace(
            day=1, hour=9, minute=0, second=0, microsecond=0
        )
        if now.day == 1 and now.hour < 9:
            candidate = nine_am
    else:
        return None

    # Never schedule into the past relative to the last run.
    if last_run and candidate <= last_run:
        if frequency == "daily":
            candidate += dt.timedelta(days=1)
        elif frequency == "weekly":
            candidate += dt.timedelta(days=7)
        elif frequency == "monthly":
            candidate = (candidate.replace(day=28) + dt.timedelta(days=4)).replace(
                day=1, hour=9, minute=0, second=0, microsecond=0
            )
    return candidate


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
        "next_run": _compute_next_run(r.frequency, r.last_run).isoformat()
        if r.enabled else None,
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


# ── Report runs (delivery history + manual runs) ──────────────────
def _build_report_payload(db: Session, business_id: int, report_type: str) -> dict:
    """Compute the actual data a report run contains, from live tenant data.

    This is what makes scheduled reports REAL: the content is generated
    server-side from the same KPI pipeline the dashboard uses, instead of
    being a client-side fiction.
    """
    from ..routers.analytics import _compute_kpis

    kpis = _compute_kpis(db, business_id)
    payload = {
        "report_type": report_type,
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "total_revenue": float(kpis.total_revenue or 0),
        "total_sales": kpis.total_sales,
        "total_customers": kpis.total_customers,
        "total_products": kpis.total_products,
        "low_stock_count": kpis.low_stock_count,
        "pending_invoices": kpis.pending_invoices,
        "overdue_invoices": kpis.overdue_invoices,
        "top_products": kpis.top_products or [],
    }
    if report_type == "anomaly-report":
        from ..routers.ai import get_anomaly_alerts
        anomalies = get_anomaly_alerts(min_confidence=0.0, db=db, current_user=_FakeUser(business_id))
        payload["anomaly_count"] = anomalies.get("summary", {}).get("total_anomalies", 0)
    return payload


class _FakeUser:
    """Minimal stand-in with business_id for internal endpoint reuse."""

    def __init__(self, business_id: int):
        self.business_id = business_id


def _period_slot(frequency: str, now: dt.datetime) -> Optional[dt.datetime]:
    """This period's 9:00 AM schedule slot (the time the report is DUE).

    daily -> today 09:00, weekly -> this week's Monday 09:00,
    monthly -> the 1st of this month 09:00 — matching the UI copy and
    _compute_next_run's anchors. None for an unknown frequency.
    """
    nine_am = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if frequency == "daily":
        return nine_am
    if frequency == "weekly":
        days_since_monday = now.weekday()  # Monday == 0
        return nine_am - dt.timedelta(days=days_since_monday)
    if frequency == "monthly":
        return nine_am.replace(day=1)
    return None


def run_due_scheduled_reports(db: Session, now: Optional[dt.datetime] = None) -> int:
    """Execute every enabled schedule whose slot has passed since its last run.

    This is what makes Scheduled Reports real: a daily/weekly/monthly setting
    used to be a row the user could only "run now" by hand. The startup
    scheduler thread (main.py) calls this every 60s; `now` is injectable so
    tests can assert due-detection without waiting for a 9 AM wall clock.

    Due rule: the schedule fires once per period, when `now` is past this
    period's 9 AM slot AND last_run predates that slot. A server that was
    down at the slot catches up on the next tick (once — last_run is stamped,
    so no duplicate fire). NOTE: _compute_next_run is deliberately NOT used
    for due detection — it returns the next strictly-future occurrence, so
    comparing it against `now` could never trigger.

    Returns the number of schedules executed (success or failed — both are
    recorded as ReportRun rows so the delivery history shows them).
    """
    now = now or dt.datetime.now()
    executed = 0
    schedules = (
        db.query(ScheduledReport)
        .filter(ScheduledReport.enabled.is_(True))
        .all()
    )
    for r in schedules:
        if r.business_id is None:
            continue
        slot = _period_slot(r.frequency, now)
        if slot is None or now < slot:
            continue  # unknown frequency, or the slot hasn't arrived yet
        if r.last_run is not None and r.last_run >= slot:
            continue  # already ran at/after this period's slot
        try:
            _build_report_payload(db, r.business_id, r.report_type)
            status = "success"
            detail = f"Auto-run: generated {r.report_type} on schedule"
        except Exception as exc:
            status = "failed"
            detail = str(exc)[:300]
        db.add(ReportRun(
            business_id=r.business_id, schedule_id=r.id,
            report_type=r.report_type, format=r.format,
            recipients=r.recipients, status=status, detail=detail,
        ))
        r.last_run = now
        executed += 1
    if executed:
        db.commit()
    return executed


@router.post("/scheduled-reports/{report_id}/run")
def run_scheduled_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate the report NOW from live data and record the delivery.

    Returns the computed payload so the UI can show/exports it, persists a
    ReportRun history row, and stamps last_run on the schedule.
    """
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

    try:
        payload = _build_report_payload(db, current_user.business_id, r.report_type)
        status = "success"
        detail = f"Generated {r.report_type} for {len(json.loads(r.recipients)) if r.recipients else 0} recipient(s)"
    except Exception as exc:
        payload = {}
        status = "failed"
        detail = str(exc)[:300]

    run = ReportRun(
        business_id=current_user.business_id,
        schedule_id=r.id,
        report_type=r.report_type,
        format=r.format,
        recipients=r.recipients,
        status=status,
        detail=detail,
    )
    db.add(run)
    r.last_run = dt.datetime.utcnow()
    db.commit()

    return {
        "run_id": run.id,
        "status": status,
        "report": payload,
        "last_run": r.last_run.isoformat(),
        "next_run": _compute_next_run(r.frequency, r.last_run).isoformat(),
    }


@router.get("/scheduled-reports/{report_id}/runs")
def list_report_runs(
    report_id: int,
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delivery history for one schedule (newest first)."""
    exists = (
        db.query(ScheduledReport.id)
        .filter(
            ScheduledReport.id == report_id,
            ScheduledReport.business_id == current_user.business_id,
        )
        .first()
    )
    if not exists:
        raise HTTPException(404, "Report not found")
    runs = (
        db.query(ReportRun)
        .filter(
            ReportRun.schedule_id == report_id,
            ReportRun.business_id == current_user.business_id,
        )
        .order_by(desc(ReportRun.created_at))
        .limit(limit)
        .all()
    )
    return [{
        "id": run.id,
        "report_type": run.report_type,
        "format": run.format,
        "recipients": json.loads(run.recipients) if run.recipients else [],
        "status": run.status,
        "detail": run.detail,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    } for run in runs]


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


def _deactivate_other_layouts(db: Session, business_id: int, exclude_id: Optional[int] = None) -> None:
    """Enforce exactly ONE active layout per business.

    The old builder POSTed a new row on every save without deactivating the
    previous one, so tenants accumulated several is_active=true rows and the
    main Dashboard's pick depended on row order. Saving with is_active=true
    now demotes every sibling in the same transaction.
    """
    q = db.query(DashboardLayout).filter(
        DashboardLayout.business_id == business_id,
        DashboardLayout.is_active.is_(True),
    )
    if exclude_id is not None:
        q = q.filter(DashboardLayout.id != exclude_id)
    q.update({"is_active": False}, synchronize_session=False)


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
    if body.is_active:
        db.flush()
        _deactivate_other_layouts(db, current_user.business_id, exclude_id=d.id)
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
    if body.is_active:
        _deactivate_other_layouts(db, current_user.business_id, exclude_id=d.id)
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