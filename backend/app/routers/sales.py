import csv
import uuid
from datetime import datetime
from io import StringIO
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/sales", tags=["sales"])

create_roles = [
    models.RoleEnum.sales_executive.value, 
    models.RoleEnum.store_manager.value, 
    models.RoleEnum.admin.value
]

def process_single_sale(db: Session, sale_data: schemas.SalesRecordCreate, user_id: int):
    # 1. Check Product & Stock
    product = db.query(models.Product).filter(models.Product.id == sale_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product ID {sale_data.product_id} not found.")
    
    if product.stock_qty < sale_data.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock for product {product.name}. Available: {product.stock_qty}, Requested: {sale_data.quantity}"
        )

    # 2. Update Stock
    product.stock_qty -= sale_data.quantity

    # 3. Create Sales Record
    total_amount = sale_data.quantity * sale_data.unit_price
    db_sale = models.SalesRecord(
        product_id=sale_data.product_id,
        customer_id=sale_data.customer_id,
        quantity=sale_data.quantity,
        unit_price=sale_data.unit_price,
        total_amount=total_amount,
        sale_date=sale_data.sale_date or datetime.utcnow(),
        created_by=user_id
    )
    db.add(db_sale)
    db.flush() # flush to get db_sale.id

    # 4. Generate Invoice
    invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
    db_invoice = models.Invoice(
        invoice_number=invoice_number,
        customer_id=sale_data.customer_id,
        sales_record_id=db_sale.id,
        amount=total_amount,
        status="paid" # Default to paid for successful POS transaction
    )
    db.add(db_invoice)
    
    return db_sale

@router.post("/transactions", response_model=schemas.SalesRecordOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    sale: schemas.SalesRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*create_roles))
):
    """Create a manual sales transaction."""
    try:
        db_sale = process_single_sale(db, sale, current_user.id)
        db.commit()
        db.refresh(db_sale)
        return db_sale
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/transactions", response_model=List[schemas.SalesRecordOut])
def get_transactions(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all sales transactions."""
    # Sales Execs might only see their own, but for milestone 1 let's keep it simple or check role
    if current_user.role == models.RoleEnum.sales_executive:
        sales = db.query(models.SalesRecord).filter(models.SalesRecord.created_by == current_user.id).offset(skip).limit(limit).all()
    else:
        sales = db.query(models.SalesRecord).offset(skip).limit(limit).all()
    return sales

@router.post("/upload")
async def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*create_roles))
):
    """
    Upload a CSV file of sales transactions.
    Expected CSV columns: product_id, customer_id, quantity, unit_price, sale_date
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode('utf-8')
    csv_reader = csv.DictReader(StringIO(decoded_content))
    
    expected_fields = ["product_id", "customer_id", "quantity", "unit_price"]
    if not all(field in csv_reader.fieldnames for field in expected_fields):
        raise HTTPException(
            status_code=400, 
            detail=f"CSV is missing required columns. Expected at least: {', '.join(expected_fields)}"
        )

    successful_records = 0
    errors = []

    for row_num, row in enumerate(csv_reader, start=2): # start=2 to account for header
        try:
            # Parse row
            product_id = int(row["product_id"])
            customer_id = int(row["customer_id"]) if row.get("customer_id") else None
            quantity = int(row["quantity"])
            unit_price = float(row["unit_price"])
            
            sale_date = None
            if row.get("sale_date"):
                try:
                    sale_date = datetime.fromisoformat(row["sale_date"].replace('Z', '+00:00'))
                except ValueError:
                    pass # fallback to None which sets to datetime.utcnow() in process_single_sale

            sale_data = schemas.SalesRecordCreate(
                product_id=product_id,
                customer_id=customer_id,
                quantity=quantity,
                unit_price=unit_price,
                sale_date=sale_date
            )
            
            process_single_sale(db, sale_data, current_user.id)
            successful_records += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    if successful_records > 0:
        db.commit() # Commit all successful records in a transaction
    else:
        db.rollback() # If nothing succeeded, rollback just in case
        
    return {
        "message": f"Processed {successful_records} sales records successfully.",
        "errors": errors
    }
