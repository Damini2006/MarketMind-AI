import uuid
import datetime as dt
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


def _generate_invoice_number() -> str:
    return f"INV-{dt.datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


@router.get("/", response_model=List[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Invoice).order_by(models.Invoice.created_at.desc()).all()


@router.post("/", response_model=schemas.InvoiceOut, status_code=201)
def create_invoice(
    payload: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("sales_executive", "business_owner", "admin")),
):
    invoice = models.Invoice(
        customer_id=payload.customer_id,
        invoice_number=_generate_invoice_number(),
        amount=payload.amount,
        status=payload.status,
        due_date=payload.due_date,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.patch("/{invoice_id}/status", response_model=schemas.InvoiceOut)
def update_invoice_status(
    invoice_id: int,
    payload: schemas.InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("sales_executive", "business_owner", "admin")),
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if payload.status not in {"pending", "paid", "overdue"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    invoice.status = payload.status
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/overdue/check")
def check_overdue(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Marks pending invoices past their due date as overdue and returns the updated count."""
    now = dt.datetime.utcnow()
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "pending", models.Invoice.due_date < now)
        .all()
    )
    for inv in invoices:
        inv.status = "overdue"
    db.commit()
    return {"marked_overdue": len(invoices)}
