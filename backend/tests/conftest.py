"""Shared pytest fixtures: isolated SQLite DB + a FastAPI app with all routers.

The suite never touches production config: DATABASE_URL is pointed at a
throwaway SQLite file before any app import, and the test app is assembled
from routers directly (skipping main.py's background warm-up/seed threads).
"""
import os
import sys
import pathlib
import tempfile

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# Must be set BEFORE any app import.
_TMP_DB = os.path.join(tempfile.mkdtemp(prefix="marketmind_test_"), "test.sqlite3")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal
from app import models
from app.core.security import hash_password
from app.routers import (
    auth, customers, inventory, sales, invoices, analytics, ai, revenue,
    categories, suppliers, datasets, users, notifications,
)
from app.routers.websocket_alerts import router as ws_router
from app.routers.audit import router as audit_router
from app.routers.user_data import router as user_data_router
from app.routers.activity import router as activity_router
from app.routers.system import router as system_router


def _build_app() -> FastAPI:
    app = FastAPI()
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
    app.include_router(revenue.router)
    app.include_router(ws_router)
    app.include_router(audit_router)
    app.include_router(user_data_router)
    app.include_router(activity_router)
    app.include_router(system_router)
    return app


@pytest.fixture(scope="session")
def app():
    Base.metadata.create_all(bind=engine)
    yield _build_app()
    engine.dispose()


@pytest.fixture(scope="session")
def client(app):
    """One TestClient for the whole session: tokens are session-scoped."""
    with TestClient(app) as c:
        yield c


# --------------------------------------------------------------------------
# Seeded history design
# --------------------------------------------------------------------------
# The churn model anchors "how long ago did they last buy" on
# `reference_date = max(sale_date)` across the tenant, NOT on wall-clock
# time. So a customer only reads as lapsed if their last visit sits well
# BEFORE the newest visit in the dataset. The seed therefore keeps a set of
# customers ordering right up to the final day, and gives a second set their
# own end-of-history cutoff.
#
# Twelve months (365 days) rather than the old 90 days because:
#   * `ml/churn.py` needs `frequency >= 4` per customer for a spend_trend,
#     and `_pick_holdout_cutoffs` needs >= 10 visit dates before it can carve
#     PAST->FUTURE out-of-time training windows at all.
#   * With only ~90 days the model saw ~20 total samples, which pinned
#     cross-validated accuracy at the small-sample ceiling.
HISTORY_DAYS = 365

# (visit interval in days, last active day offset within the 365-day window)
# A `last_day` well below HISTORY_DAYS-1 means that customer went quiet and
# therefore carries a large recency_days against the global reference date.
CUSTOMER_ROUTES = {
    0:  (3, 364),   # loyal, every 3 days, active through the end
    1:  (4, 364),   # loyal, every 4 days, active through the end
    2:  (5, 364),   # loyal, every 5 days, active through the end
    3:  (3, 364),   # loyal, every 3 days, active through the end
    4:  (4, 364),   # loyal, every 4 days, active through the end
    5:  (6, 364),   # loyal, slower cadence but still active at the end
    6:  (3, 364),   # loyal, every 3 days, active through the end
    7:  (4, 300),   # lapsed ~64 days before the newest sale  -> churn
    8:  (6, 265),   # lapsed ~99 days before the newest sale  -> churn
    9:  (8, 235),   # lapsed ~129 days before the newest sale -> churn
    10: (5, 195),   # lapsed ~169 days before the newest sale -> churn
    11: (7, 155),   # lapsed deepest; still has real history  -> churn
}


@pytest.fixture(scope="session")
def seeded_business():
    """One business with rich data (owner + sales exec), created once."""
    db = SessionLocal()
    try:
        biz = models.Business(company_name="Test Mart")
        db.add(biz)
        db.flush()

        owner = models.User(
            full_name="Owner",
            email="owner@test.com",
            hashed_password=hash_password("Owner@123"),
            role=models.RoleEnum.business_owner,
            business_id=biz.id,
        )
        sales_exec = models.User(
            full_name="Sales Exec",
            email="sales@test.com",
            hashed_password=hash_password("Sales@123"),
            role=models.RoleEnum.sales_executive,
            business_id=biz.id,
        )
        db.add_all([owner, sales_exec])

        # Products + customers + a deterministic 12-month sales history long
        # enough for forecast/churn/segmentation to train on.
        import datetime as _dt
        prods = []
        for i in range(6):
            p = models.Product(
                name=f"Product {i}", category="Grocery", price=100.0 + i,
                stock_quantity=50, reorder_threshold=10, business_id=biz.id,
            )
            db.add(p)
            prods.append(p)
        custs = []
        for i in range(12):
            c = models.Customer(
                name=f"Customer {i}", email=f"c{i}@test.com", business_id=biz.id,
            )
            db.add(c)
            custs.append(c)
        db.flush()

        # Realistic shopping behaviour: every customer has PRODUCT PREFERENCES
        # (80% of purchases from 2 favourite products) and a personal cadence,
        # so segments/recommendations/churn all have genuine per-customer
        # signal -- a fixture where everyone buys everything equally makes
        # identical model outputs the CORRECT answer and the tests meaningless.
        import random as _random
        rng = _random.Random(7)

        def _pick_product(idx):
            favourites = (idx % len(prods), (idx + 2) % len(prods))
            if rng.random() < 0.8:
                return prods[favourites[rng.randint(0, 1)]]
            return prods[rng.randrange(len(prods))]

        start = _dt.datetime.utcnow() - _dt.timedelta(days=HISTORY_DAYS)

        # Quantities ramp over the year (roughly 1x -> 3x) so aggregate daily
        # revenue trends upward, which is what the forecast-direction test
        # asserts: the model must agree with the data's actual direction.
        rows = []
        for idx, c in enumerate(custs):
            interval, last_day = CUSTOMER_ROUTES[idx]
            # Stagger the first visit so customers don't all land on day 0.
            first_day = (idx * 5) % interval
            day = first_day
            while day <= last_day:
                current = start + _dt.timedelta(days=day)
                base_qty = 1 + day // 120
                # 1-2 line items per visit; the churn module collapses
                # same-day line items into a single "visit" before any
                # cadence math, so this stays one visit per `day`.
                for k in range(1 + (idx + day) % 2):
                    p = _pick_product(idx)
                    qty = base_qty + rng.randint(0, 1)
                    rows.append(models.Sale(
                        customer_id=c.id, product_id=p.id,
                        quantity=qty, unit_price=p.price,
                        total_amount=qty * p.price,
                        sale_date=current.replace(hour=10, minute=idx),
                        source="seed", business_id=biz.id,
                    ))
                day += interval

        db.add_all(rows)
        db.commit()
        return {"business_id": biz.id, "owner_id": owner.id, "sales_id": sales_exec.id}
    finally:
        db.close()


def _login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def owner_token(client, seeded_business):
    return _login(client, "owner@test.com", "Owner@123")


@pytest.fixture(scope="session")
def sales_token(client, seeded_business):
    return _login(client, "sales@test.com", "Sales@123")


@pytest.fixture(autouse=True)
def _clear_ttl_cache():
    """The AI endpoints memoise results in a module-global TTL cache keyed by
    business id. Fresh test DBs recycle small business ids, so without clearing
    between tests, one test can be served another test's cached AI result
    (order-dependent failures under test-order randomisers)."""
    from app import cache
    cache._cache.clear()
    yield
    cache._cache.clear()


@pytest.fixture(autouse=True)
def _clear_rate_store():
    """The auth limiter is process-global; brute-force tests would otherwise
    burn login/OTP budget for every later test (order-dependent 429s)."""
    from app.routers.auth import _rate_store
    _rate_store.clear()
    yield
    _rate_store.clear()


@pytest.fixture()
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture()
def sales_headers(sales_token):
    return {"Authorization": f"Bearer {sales_token}"}


@pytest.fixture()
def fresh_business():
    """A brand-new business with only its owner: proves new tenants see NO data."""
    db = SessionLocal()
    try:
        biz = models.Business(company_name="Empty Co")
        db.add(biz)
        db.flush()
        owner = models.User(
            full_name="Empty Owner",
            email=f"empty{biz.id}@test.com",
            hashed_password=hash_password("Empty@123"),
            role=models.RoleEnum.business_owner,
            business_id=biz.id,
        )
        db.add(owner)
        db.commit()
        return {"business_id": biz.id, "email": owner.email, "password": "Empty@123"}
    finally:
        db.close()
