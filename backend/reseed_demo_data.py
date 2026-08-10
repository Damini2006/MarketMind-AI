"""Reseed the demo business with the full MarketMind demo dataset.

Clears the demo business's data rows (customers, products, sales, invoices,
categories, suppliers, datasets, notifications/alerts) and runs the app's own
seeder so the business ends up with the complete demo set: 20 customers,
12 products, ~560 days of sales, 15 invoices, 5 categories, 4 suppliers and
one demo dataset record. Users are kept as-is.

Targets the business named "Mega Mart" (the demo tenant); falls back to the
first business if none is named that. Works on whichever database
DATABASE_URL points at — run it against Neon for the Postgres preview, or
against the local SQLite file for a fresh local demo.

Usage:
    cd backend
    python reseed_demo_data.py
"""
import os
import sys

from dotenv import load_dotenv

# Respect backend/.env so the script targets whichever database the app is
# configured for (currently Neon Postgres, per the restored DATABASE_URL).
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from app import models
from app.database import SessionLocal
from app.seed_data import seed_business_demo_data

# Children first so FK constraints (if any) are satisfied
TABLES_TO_CLEAR = [
    models.Notification,
    models.InventoryAlert,
    models.AnomalyAlert,
    models.Invoice,
    models.Sale,
    models.UploadedDataset,
    models.Customer,
    models.Product,
    models.Supplier,
    models.Category,
]


def main() -> int:
    from app.database import engine
    print(f"Target database: {engine.url}")
    db = SessionLocal()
    try:
        business = (
            db.query(models.Business)
            .filter(models.Business.company_name == "Mega Mart")
            .order_by(models.Business.id)
            .first()
        )
        if business is None:
            business = db.query(models.Business).order_by(models.Business.id).first()
        if business is None:
            print("No business found to reseed.")
            return 1

        print(f"Reseeding demo data for business {business.id} ({business.company_name})...")

        for model in TABLES_TO_CLEAR:
            deleted = (
                db.query(model)
                .filter(model.business_id == business.id)
                .delete(synchronize_session=False)
            )
            print(f"  cleared {model.__tablename__}: {deleted} rows")

        # Re-seed the full demo set (seeder only fills what is still missing,
        # which after the clear is everything). Commits internally.
        seed_business_demo_data(db, business)

        # Report
        counts = {
            "customers": db.query(models.Customer).filter(models.Customer.business_id == business.id).count(),
            "products": db.query(models.Product).filter(models.Product.business_id == business.id).count(),
            "sales": db.query(models.Sale).filter(models.Sale.business_id == business.id).count(),
            "invoices": db.query(models.Invoice).filter(models.Invoice.business_id == business.id).count(),
            "categories": db.query(models.Category).filter(models.Category.business_id == business.id).count(),
            "suppliers": db.query(models.Supplier).filter(models.Supplier.business_id == business.id).count(),
            "datasets": db.query(models.UploadedDataset).filter(models.UploadedDataset.business_id == business.id).count(),
            "users": db.query(models.User).filter(models.User.business_id == business.id).count(),
        }
        print("Reseeded counts:", counts)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
