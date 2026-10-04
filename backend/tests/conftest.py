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

        # Products + customers + a deterministic sales history long enough
        # for forecast/churn/segmentation to train on.
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

        start = _dt.datetime.utcnow() - _dt.timedelta(days=90)
        # Realistic shopping behaviour: every customer has PRODUCT
        # PREFERENCES (80% of purchases from 2 favourite products) and a
        # personal spend level, so segments/recommendations/churn all have
        # genuine per-customer signal to learn from -- a fixture where
        # everyone buys everything equally makes identical model outputs
        # the CORRECT answer and the tests meaningless.
        import random as _random
        rng = _random.Random(7)

        def _pick_product(idx):
            favourites = (idx % len(prods), (idx + 2) % len(prods))
            if rng.random() < 0.8:
                return prods[favourites[rng.randint(0, 1)]]
            return prods[rng.randrange(len(prods))]

        # Customers 0-8 buy steadily with per-customer quantities GROWING
        # over time (1x -> 2x); 9-11 lapse mid-way. The growth of the 9
        # steady customers dominates the lapse of 3, so the aggregate daily
        # revenue genuinely trends upward -- which is what the forecast
        # tests assert (the model must agree with the data's direction).
# Products + customers + a deterministic sales history long enough
        # for EVERY ML page to train on (12 months, not 90 days). The churn
        # model needs ~200+ visits per customer plus a healthy churn signal
        # (active customers + customers who lapse mid-window) to push accuracy
        # past the 20-sample ceiling. We keep the SAME cadence/recommendation
        # logic as before; only the time window changes.
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

        # 12-month window: 365 days. The 'now' anchor sits roughly 21 days
        # before the window end so the model has a full trailing month of
        # history (12 months - 21 days) to train on.
        start = _dt.datetime.utcnow() - _dt.timedelta(days=365)
        end = _dt.datetime.utcnow() - _dt.timedelta(days=21)

        # Realistic shopping behaviour: every customer has PRODUCT PREFERENCES,
        # 80% of purchases from 2 favourite products, plus a personal cadence,
        # so segments/recommendations/churn all have genuine per-customer
        # signal. A customer who buys on a 3-day rhythm for 9 months and then
        # stops for the last 3 months is a churn label; a customer who has
        # a steady purchase every ~4 days is a healthy label.
        import random as _random
        rng = _random.Random(7)

        def _pick_product(idx):
            favourites = (idx % len(prods), (idx + 2) % len(prods))
            if rng.random() < 0.8:
                return prods[favourites[rng.randint(0, 1)]]
            return prods[rng.randrange(len(prods))]

        # Customer cadences (visit interval in days) and routes:
        #   idx 0-6 : healthy regular cadence, tiny 20-day lapse near the end
        #           -> churn label if it persists, otherwise High activity
        #   idx 7-9 : normal cadence, then a mid-window AND end-of-window
        #           lapse -> definite churn (High risk) label
        #   idx 10  : erratic cadence (gaps between 2 and 14 days) with a
        #           30-day inactive tail -> churn (High risk) label
        #   idx 11  : clean High activity (long cadence), no lapse -> Low risk
        cadences = {
            0: (3, 'healthy_regular', 0),
            1: (4, 'healthy_regular', 0),
            2: (5, 'healthy_regular', 0),
            3: (3, 'healthy_regular', 0),
            4: (4, 'healthy_regular', 0),
            5: (6, 'healthy_regular', 0),
            6: (3, 'healthy_regular', 0),
            7: (4, 'lapse_mid', 21),
            8: (6, 'lapse_mid', 21),
            9: (8, 'lapse_mid', 21),
            10: (1, 'erratic', 30),
            11: (9, 'healthy_high_activity', 0),
        }

        def _is_lapsed(idx, day):
            _, route, tail_days = cadences[idx]
            # tail_days = how many days AFTER the window end the customer is
            # already inactive (their lapse sticks out of the window).
            if route == 'healthy_high_activity':
                return False
            if route == 'erratic':
                # erratic customers are `tail_days` inactive at the end
                return day >= end.day - tail_days
            # lapse_mid: inactive for the last `tail_days` days of the window
            return day >= end.day - tail_days

        def _quantity(idx, day):
            return 1 + (idx + day) % 4

        def _churn_label(idx, day):
            """Return True when the customer's behaviour in the FINAL 90 days
            (the 'observe window' the model trains on) is a churn signal.
            The model looks at the last 90 days of the window.
            """
            if cadences[idx][1] == 'erratic':
                # erratic = sporadic + long tail = churn
                return True
            if cadences[idx][1] == 'healthy_high_activity':
                return False
            # lapse_mid: the customer must have an ORDER within the last 90
            # days of the observe window, not later than end-21.
            observe_until = end - _dt.timedelta(days=90)
            return day <= observe_until.day

        # Build the sales history.
        _ordered = {}
        # Products + customers + a deterministic sales history long enough
        # for EVERY ML page to train on (12 months, not 90 days). The churn
        # model needs ~200+ visits per customer plus a healthy churn signal
        # (active customers + customers who lapse mid-window) to push accuracy
        # past the 20-sample ceiling. We keep the SAME cadence/recommendation
        # logic as before; only the time window changes.
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

        # 12-month window: 365 days. The 'now' anchor sits roughly 21 days
        # before the window end so the model has a full trailing month of
        # history (12 months - 21 days) to train on.
        start = _dt.datetime.utcnow() - _dt.timedelta(days=365)
        end = _dt.datetime.utcnow() - _dt.timedelta(days=21)

        # Realistic shopping behaviour: every customer has PRODUCT PREFERENCES,
        # 80% of purchases from 2 favourite products, plus a personal cadence,
        # so segments/recommendations/churn all have genuine per-customer
        # signal. A customer who buys on a 3-day rhythm for 9 months and then
        # stops for the last 3 months is a churn label; a customer who has
        # a steady purchase every ~4 days is a healthy label.
        import random as _random
        rng = _random.Random(7)

        def _pick_product(idx):
            favourites = (idx % len(prods), (idx + 2) % len(prods))
            if rng.random() < 0.8:
                return prods[favourites[rng.randint(0, 1)]]
            return prods[rng.randrange(len(prods))]

        # Customer cadences (visit interval in days) and lapse tails (how many
        # days of inactivity a customer has at the end of the window):
        #   idx 0-6  : healthy regular cadence, tiny 20-day lapse near the end
        #              -> churn label if it persists, otherwise High activity
        #   idx 7-9  : normal cadence, then a mid-window AND end-of-window
        #              lapse -> definite churn (High risk) label
        #   idx 10   : erratic cadence (gaps between 2 and 14 days) with a
        #              30-day inactive tail -> churn (High risk) label
        #   idx 11   : clean High activity (long cadence), no lapse -> Low risk
        cadences = {
            0: (3, 'healthy_regular', 0),
            1: (4, 'healthy_regular', 0),
            2: (5, 'healthy_regular', 0),
            3: (3, 'healthy_regular', 0),
            4: (4, 'healthy_regular', 0),
            5: (6, 'healthy_regular', 0),
            6: (3, 'healthy_regular', 0),
            7: (4, 'lapse_mid', 21),
            8: (6, 'lapse_mid', 21),
            9: (8, 'lapse_mid', 21),
            10: (1, 'erratic', 30),
            11: (9, 'healthy_high_activity', 0),
        }

        # Build the sales history.
        _ordered = {}
        sales = []
        for idx, c in enumerate(custs):
            cid = c.id
            interval = cadences[idx][0]
            tail = cadences[idx][2]
            # Active window runs `start` -> `end`; a customer with a `tail`
            # (lapse) is inactive for `tail` days at the end.
            max_day = 365 - tail
            start_day = (idx * 7) % interval
            for day in range(start_day, max_day, interval):
                p = _pick_product(idx)
                qty = 1 + (idx + day) % 4
                sales.append(models.Sale(
                    customer_id=cid, product_id=p.id,
                    quantity=qty, unit_price=p.price,
                    total_amount=qty * p.price,
                    sale_date=start + _dt.timedelta(days=day),
                    source="seed", business_id=biz.id,
                ))
                _ordered[cid] = day

        db.add_all(sales)
        db.commit()

        return {"business_id": biz.id, "email": owner.email, "password": "Empty@123"}
    finally:
        db.close()
