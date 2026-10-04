import datetime as dt
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas
from ..cache import get_or_set
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _compute_kpis(db: Session, business_id: int):
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == business_id)
        .all()
    )
    total_revenue = sum(s.total_amount for s in sales)
    total_sales = len(sales)
    total_customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == business_id)
        .count()
    )
    total_products = (
        db.query(models.Product)
        .filter(models.Product.business_id == business_id)
        .count()
    )
    low_stock_count = (
        db.query(models.Product)
        .filter(
            models.Product.business_id == business_id,
            models.Product.stock_quantity <= models.Product.reorder_threshold,
        )
        .count()
    )
    pending_invoices = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.business_id == business_id,
            models.Invoice.status == "pending",
        )
        .count()
    )
    overdue_invoices = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.business_id == business_id,
            models.Invoice.status == "overdue",
        )
        .count()
    )

    revenue_by_day = defaultdict(float)
    for s in sales:
        day = s.sale_date.strftime("%Y-%m-%d")
        revenue_by_day[day] += s.total_amount
    revenue_series = [{"date": d, "revenue": round(v, 2)} for d, v in sorted(revenue_by_day.items())][-30:]

    product_revenue = defaultdict(float)
    for s in sales:
        if s.product_id:
            product_revenue[s.product_id] += s.total_amount
    top_ids = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
    products_by_id = {
        p.id: p
        for p in db.query(models.Product)
        .filter(models.Product.business_id == business_id)
        .all()
    }
    top_products = [
        {"product": products_by_id[pid].name if pid in products_by_id else f"#{pid}", "revenue": round(rev, 2)}
        for pid, rev in top_ids
    ]

    return schemas.KPIResponse(
        total_revenue=round(total_revenue, 2),
        total_sales=total_sales,
        total_customers=total_customers,
        total_products=total_products,
        low_stock_count=low_stock_count,
        pending_invoices=pending_invoices,
        overdue_invoices=overdue_invoices,
        revenue_by_day=revenue_series,
        top_products=top_products,
    )


@router.get("/pulse")
def business_pulse(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Business Pulse health score (0-100) with breakdown.
    Mirrors the client-side score in BusinessPulse.jsx so the
    dashboard shows a real server value instead of a 404 + fallback."""
    kpis = get_or_set(
        f"analytics:{current_user.business_id}:kpis",
        300,
        lambda: _compute_kpis(db, current_user.business_id),
    )

    # Revenue trend (40%): last 7 days avg vs previous 7 days
    days = kpis.revenue_by_day or []
    recent7 = days[-7:]
    prev7 = days[-14:-7]
    recent_avg = sum(d["revenue"] for d in recent7) / len(recent7) if recent7 else 0
    prev_avg = sum(d["revenue"] for d in prev7) / len(prev7) if prev7 else 1
    revenue_score = (
        min(100, round((recent_avg / prev_avg) * 80)) if prev_avg > 0 else (70 if recent_avg > 0 else 0)
    )

    # Inventory health (30%)
    inv_score = (
        round(max(0, 100 - (kpis.low_stock_count / kpis.total_products) * 100))
        if kpis.total_products > 0 else 100
    )

    # Invoice collection (30%)
    total_inv = kpis.pending_invoices + kpis.overdue_invoices
    invoice_score = (
        100 if total_inv == 0
        else round(max(0, 100 - (kpis.overdue_invoices / max(1, total_inv)) * 100))
    )

    score = round(revenue_score * 0.4 + inv_score * 0.3 + invoice_score * 0.3)

    parts = []
    if recent_avg > prev_avg:
        parts.append("Revenue is trending up")
    elif recent_avg < prev_avg:
        parts.append("Revenue is trending down")
    else:
        parts.append("Revenue is steady")
    if kpis.low_stock_count > 0:
        parts.append(f"{kpis.low_stock_count} item{'s' if kpis.low_stock_count > 1 else ''} low on stock")
    if kpis.overdue_invoices > 0:
        parts.append(f"{kpis.overdue_invoices} overdue invoice{'s' if kpis.overdue_invoices > 1 else ''}")
    if kpis.top_products:
        parts.append(f"Top seller: {kpis.top_products[0]['product']}")

    return {
        "score": score,
        "breakdown": [
            {"label": "Revenue Trend", "key": "revenueTrend", "value": revenue_score, "weight": 40},
            {"label": "Inventory Health", "key": "inventoryHealth", "value": inv_score, "weight": 30},
            {"label": "Invoice Collection", "key": "invoiceCollection", "value": invoice_score, "weight": 30},
        ],
        "briefing": " · ".join(parts),
    }


@router.get("/kpis", response_model=schemas.KPIResponse)
def kpis(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Dashboard KPIs. Cached 300s — recomputing on every page load is
    wasteful, and the cold compute is ~6s over Neon (5 queries)."""
    return get_or_set(
        f"analytics:{current_user.business_id}:kpis",
        300,
        lambda: _compute_kpis(db, current_user.business_id),
    )
