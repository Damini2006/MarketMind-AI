import datetime as dt
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@router.get("/", response_model=List[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Invoice).join(models.Sale).filter(models.Sale.business_id == current_user.business_id).order_by(models.Invoice.created_at.desc()).all()


@router.post("/", response_model=schemas.InvoiceOut, status_code=201)
def create_invoice(
    payload: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("sales_executive", "business_owner", "admin")),
):
    sale = db.query(models.Sale).filter(models.Sale.id == payload.sale_id, models.Sale.business_id == current_user.business_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    existing_invoice = db.query(models.Invoice).filter(models.Invoice.sale_id == sale.id).first()
    if existing_invoice:
        raise HTTPException(status_code=400, detail="This sale already has an invoice.")
        
    invoice = models.Invoice(
        sale_id=payload.sale_id,
        invoice_number=sale.invoice_number,
        due_date=payload.due_date,
        invoice_status="pending",
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
    invoice = db.query(models.Invoice).join(models.Sale).filter(models.Invoice.id == invoice_id, models.Sale.business_id == current_user.business_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if payload.status not in {"pending", "paid", "overdue"}:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    invoice.invoice_status = payload.status
    if payload.status == "paid":
        invoice.payment_date = dt.datetime.utcnow().date()
        if invoice.sale:
            invoice.sale.payment_status = "completed"
            
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/overdue/check")
def check_overdue(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Marks pending invoices past their due date as overdue and returns the updated count."""
    now = dt.datetime.utcnow().date()
    invoices = (
        db.query(models.Invoice)
        .join(models.Sale)
        .filter(
            models.Invoice.invoice_status == "pending", 
            models.Invoice.due_date < now,
            models.Sale.business_id == current_user.business_id
        )
        .all()
    )
    for inv in invoices:
        inv.invoice_status = "overdue"
    db.commit()
    return {"marked_overdue": len(invoices)}
