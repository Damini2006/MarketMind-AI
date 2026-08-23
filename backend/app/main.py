import os
import threading
import time
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

# Load environment variables from .env file before anything else runs
load_dotenv()

from .database import Base, DATABASE_URL, engine, SessionLocal
from .migrate import ensure_business_id_columns
from .seed_data import seed_if_empty
from . import models

# Directory that serves user uploads (profile photos, etc.)
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)
from .routers import (
    auth,
    customers,
    inventory,
    sales,
    invoices,
    analytics,
    ai,
    categories,
    suppliers,
    datasets,
    users,
    notifications,
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Lightweight migration: add business_id columns + backfill on pre-existing SQLite DBs
ensure_business_id_columns(engine)

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - API",
    version="1.0.0",
)

# Compress JSON responses (the big list payloads: sales, customers, KPIs...)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# For remote databases (e.g. Neon Postgres), pre-warm the connection pool so
# the first requests don't pay a cold connection, and keep a background ping
# alive so the serverless compute doesn't sleep mid-session (which is what
# caused multi-second stalls). SQLite needs none of this.
if not DATABASE_URL.startswith("sqlite"):

    def _ping() -> None:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

    def _keepalive() -> None:
        while True:
            time.sleep(120)
            try:
                _ping()
            except Exception:
                pass

    try:
        _ping()
        _ping()
    except Exception:
        pass
    threading.Thread(target=_keepalive, daemon=True).start()

# Serve uploaded files (avatars) — must be mounted before routers that
# define /api routes; StaticFiles only matches paths under /uploads.
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Note: Routers already include their /api/ path prefix internally.
# Including them directly prevents path doubling (e.g., /api/api/customers).
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(invoices.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(categories.router)
app.include_router(suppliers.router)
app.include_router(datasets.router)
app.include_router(users.router)
app.include_router(notifications.router)


@app.on_event("startup")
def startup_seed():
    """Runs on backend server start to seed database if empty."""
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    _start_cache_warmup()


def _start_cache_warmup() -> None:
    """Pre-compute per-business KPIs + AI results on a background thread.

    Every Neon round-trip costs ~1s, so the first request after a restart used
    to pay that for EACH endpoint (KPIs, forecast, segmentation, ...). Warming
    the shared TTL caches here means real users hit warm caches immediately.
    Never blocks startup; failures are swallowed per business.
    """
    from types import SimpleNamespace

    from .cache import get_or_set
    from .routers import ai, analytics, notifications as notif_router

    def _warm() -> None:
        db = SessionLocal()
        try:
            bids = [r[0] for r in db.query(models.Business.id).all()]
        finally:
            db.close()

        for bid in bids:
            try:
                wdb = SessionLocal()
                try:
                    fake = SimpleNamespace(business_id=bid)
                    get_or_set(
                        f"analytics:{bid}:kpis",
                        300,
                        lambda: analytics._compute_kpis(wdb, bid),
                    )
                    ai.get_sales_forecast(horizon_days=14, db=wdb, current_user=fake)
                    ai.get_sales_forecast(horizon_days=30, db=wdb, current_user=fake)
                    ai.get_customer_segmentation(db=wdb, current_user=fake)
                    ai.get_churn_predictions(db=wdb, current_user=fake)
                    ai.get_product_recommendations(db=wdb, current_user=fake)
                    ai.get_anomaly_alerts(db=wdb, current_user=fake)
                    notif_router._sync_notifications(wdb, bid)
                finally:
                    wdb.close()
            except Exception:
                pass

    threading.Thread(target=_warm, daemon=True).start()


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "MarketMind AI API is running. Visit /docs for interactive API documentation.",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}