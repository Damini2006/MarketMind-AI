import io
import datetime as dt
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from ..core.uploads import read_csv_upload
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas
from ..cache import get_or_set, invalidate
from ..database import get_db
from ..deps import get_current_user, require_roles
from .inventory import _check_and_create_alert, _ensure_inventory_row, _record_inventory_transaction
from ..ml.business_alerts import check_sale_business_rules

router = APIRouter(prefix="/api/sales", tags=["Sales"])

REQUIRED_CSV_COLUMNS = {"product_name", "quantity", "unit_price"}


def _load_sales(db: Session, business_id: int, limit: int, offset: int = 0):
    """Fetch the sales list with pagination and serialize it."""
    return [
        schemas.SaleOut.model_validate(s).model_dump(mode="json")
        for s in db.query(models.Sale)
        .filter(models.Sale.business_id == business_id)
        .order_by(models.Sale.sale_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    ]


def _count_sales(db: Session, business_id: int) -> int:
    """Count total sales for pagination metadata."""
    return db.query(func.count(models.Sale.id)).filter(models.Sale.business_id == business_id).scalar() or 0


@router.get("/")
def list_sales(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List sales with server-side pagination. Returns {items, total, limit, offset}."""
    bid = current_user.business_id
    # Cache total count (changes rarely)
    total = get_or_set(
        f"sales_count:{bid}",
        60,
        lambda: _count_sales(db, bid),
    )
    # Cache the page (changes with every new sale)
    items = get_or_set(
        f"sales_list:{bid}:{limit}:{offset}",
        60,
        lambda: _load_sales(db, bid, limit, offset),
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=schemas.SaleOut, status_code=201)
def create_sale(
    payload: schemas.SaleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    total = payload.unit_price * payload.quantity
    sale = models.Sale(
        customer_id=payload.customer_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        total_amount=total,
        sale_date=payload.sale_date or dt.datetime.utcnow(),
        source="manual",
        business_id=current_user.business_id,
    )
    db.add(sale)
    db.flush()
    # Line item (pre-dev parity) — one row per product on the sale.
    db.add(
        models.SaleItem(
            sale_id=sale.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            total=total,
        )
    )
    if payload.product_id:
        product = (
            db.query(models.Product)
            .filter(
                models.Product.id == payload.product_id,
                models.Product.business_id == current_user.business_id,
            )
            .first()
        )
        if product:
            product.stock_quantity = max(0, product.stock_quantity - payload.quantity)
            stock_before = product.stock_quantity
            _ensure_inventory_row(db, product)
            _record_inventory_transaction(
                db, product.id, current_user.id, "OUT", payload.quantity, f"Sale #{sale.id}"
            )
            db.commit()
            _check_and_create_alert(db, product)
            # Business-rule alerts: large quantity sale, significant stock depletion
            stock_after = max(0, stock_before - payload.quantity)
            try:
                check_sale_business_rules(
                    db=db,
                    product=product,
                    quantity_sold=payload.quantity,
                    stock_before=stock_before,
                    stock_after=stock_after,
                    business_id=current_user.business_id,
                )
                db.commit()
            except Exception:
                db.rollback()
    db.commit()
    db.refresh(sale)
    invalidate("sales_list:")
    invalidate("sales_count:")
    invalidate("ai:")  # forecast/segmentation/churn/anomalies recompute on next call
    return sale


@router.post("/upload-csv")
def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "sales_executive", "admin")),
):
    """
    Upload a CSV of historical/point-of-sale transactions.
    Expected columns: product_name, quantity, unit_price, [customer_name], [sale_date]
    Performs validation, auto-creates missing products/customers (matched case/whitespace-insensitively),
    and stores transactions.
    """
    raw = read_csv_upload(file)
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    missing = REQUIRED_CSV_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=422, detail=f"CSV missing required columns: {sorted(missing)}")

    df = df.dropna(subset=["product_name", "quantity", "unit_price"])
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")
    df = df.dropna(subset=["quantity", "unit_price"])
    df = df[(df["quantity"] > 0) & (df["unit_price"] >= 0)]

    # Parse the date column once up front. The duplicate guard below compares
    # the exact timestamp that will be stored, so the parsed value has to be
    # decided here rather than inside the insert loop (where a failed parse
    # silently became "now" -- a value that can never match an existing row).
    if "sale_date" in df.columns:
        parsed = pd.to_datetime(df["sale_date"], errors="coerce")
        if getattr(parsed.dt, "tz", None) is not None:
            # The column is a naive DateTime, so an offset cannot be kept.
            parsed = parsed.dt.tz_localize(None)
        df["sale_date"] = parsed
    else:
        df["sale_date"] = pd.NaT

    # ── Duplicate guard ──────────────────────────────────────────────
    # Uploading the same file twice used to insert a second (and third) copy of
    # every row, multiplying that period's revenue -- business 1's Aug 1-10
    # rows were imported three times and trebled. A row counts as a duplicate
    # only when the FULL transaction identity matches: same product, customer,
    # quantity, unit price AND timestamp. A genuine repeat purchase later the
    # same day carries a different timestamp and is still imported.
    def _as_naive(value):
        return value.to_pydatetime() if hasattr(value, "to_pydatetime") else value

    parsed_dates = df["sale_date"].dropna()
    existing_keys = set()
    if not parsed_dates.empty:
        lo = _as_naive(parsed_dates.min())
        hi = _as_naive(parsed_dates.max() + pd.Timedelta(days=1))
        existing_rows = (
            db.query(
                models.Sale.product_id,
                models.Sale.customer_id,
                models.Sale.quantity,
                models.Sale.unit_price,
                models.Sale.sale_date,
            )
            .filter(
                models.Sale.business_id == current_user.business_id,
                models.Sale.sale_date >= lo,
                models.Sale.sale_date < hi,
            )
            .all()
        )
        existing_keys = {(p, c, int(q), float(u), d) for p, c, q, u, d in existing_rows}

    created, skipped, duplicates = 0, 0, 0
    for _, row in df.iterrows():
        try:
            pname = str(row["product_name"]).strip()
            product = (
                db.query(models.Product)
                .filter(
                    func.lower(func.trim(models.Product.name)) == pname.lower(),
                    models.Product.business_id == current_user.business_id,
                )
                .first()
            )
            if not product:
                product = models.Product(
                    name=pname,
                    price=float(row["unit_price"]),
                    stock_quantity=0,
                    business_id=current_user.business_id,
                )
                db.add(product)
                db.flush()

            customer = None
            if "customer_name" in df.columns and pd.notna(row.get("customer_name")):
                cname = str(row["customer_name"]).strip()
                customer = (
                    db.query(models.Customer)
                    .filter(
                        func.lower(func.trim(models.Customer.name)) == cname.lower(),
                        models.Customer.business_id == current_user.business_id,
                    )
                    .first()
                )
                if not customer:
                    customer = models.Customer(name=cname, business_id=current_user.business_id)
                    db.add(customer)
                    db.flush()

            sale_date = (
                row["sale_date"].to_pydatetime()
                if pd.notna(row["sale_date"])
                else dt.datetime.utcnow()
            )
            qty = int(row["quantity"])
            price = float(row["unit_price"])

            key = (product.id, customer.id if customer else None, qty, price, sale_date)
            if key in existing_keys:
                duplicates += 1
                continue
            existing_keys.add(key)  # also guards duplicates WITHIN one file

            sale = models.Sale(
                customer_id=customer.id if customer else None,
                product_id=product.id,
                quantity=qty,
                unit_price=price,
                total_amount=qty * price,
                sale_date=sale_date,
                source="csv_upload",
                business_id=current_user.business_id,
            )
            db.add(sale)
            db.flush()
            # Line item + inventory ledger mirror (pre-dev parity). Historical
            # imports don't deduct current stock — products keep their stock.
            db.add(
                models.SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=qty,
                    unit_price=price,
                    total=qty * price,
                )
            )
            _ensure_inventory_row(db, product)
            created += 1
        except Exception:
            skipped += 1
            continue

    db.commit()

    # Record the upload in the datasets log so the Datasets page can show it.
    # Duplicates are counted as "invalid" so the page's arithmetic holds
    # (total = valid + invalid); the response reports them separately so the
    # UI can say "duplicate" rather than implying the data was malformed.
    dataset = models.UploadedDataset(
        file_name=file.filename,
        validation_status="valid",
        total_records=int(len(df)),
        valid_records=created,
        invalid_records=skipped + duplicates,
        uploaded_by=current_user.id,
        business_id=current_user.business_id,
    )
    db.add(dataset)
    db.commit()
    # Uploads also create products/customers, so bust both list caches.
    invalidate("sales_list:")
    invalidate("sales_count:")
    invalidate("customers_list:")
    invalidate("ai:")

    return {
        "rows_processed": int(len(df)),
        "sales_created": created,
        "rows_skipped": skipped,
        "rows_duplicate": duplicates,
    }