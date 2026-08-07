import datetime as dt
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/kpis", response_model=schemas.KPIResponse)
def kpis(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sales = db.query(models.Sale).options(joinedload(models.Sale.sale_items)).filter(models.Sale.business_id == current_user.business_id).all()
    total_revenue = sum(s.total_amount for s in sales)
    total_sales = len(sales)
    total_customers = db.query(models.Customer).filter(models.Customer.business_id == current_user.business_id).count()
    total_products = db.query(models.Product).filter(models.Product.business_id == current_user.business_id).count()
    low_stock_count = (
        db.query(models.Inventory)
        .join(models.Product)
        .filter(models.Inventory.quantity_available <= models.Inventory.reorder_level, models.Product.business_id == current_user.business_id)
        .count()
    )
    pending_invoices = db.query(models.Invoice).join(models.Sale).filter(models.Invoice.invoice_status == "pending", models.Sale.business_id == current_user.business_id).count()
    overdue_invoices = db.query(models.Invoice).join(models.Sale).filter(models.Invoice.invoice_status == "overdue", models.Sale.business_id == current_user.business_id).count()

    revenue_by_day = defaultdict(float)
    for s in sales:
        if s.sale_date:
            day = s.sale_date.strftime("%Y-%m-%d")
            revenue_by_day[day] += s.total_amount
    revenue_series = [{"date": d, "revenue": round(v, 2)} for d, v in sorted(revenue_by_day.items())][-30:]

    product_revenue = defaultdict(float)
    for s in sales:
        for item in s.sale_items:
            if item.product_id:
                product_revenue[item.product_id] += item.total
    top_ids = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
    products_by_id = {p.id: p for p in db.query(models.Product).filter(models.Product.business_id == current_user.business_id).all()}
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
