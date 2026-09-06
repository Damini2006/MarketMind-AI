"""Comprehensive API endpoint test script - ASCII safe, corrected URLs."""

import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE = "http://127.0.0.1:8000/api"

results = []


def test(name, method, url, token=None, data=None, expect=200):
    headers = {"Content-Type": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        r = getattr(requests, method)(
            url,
            json=data,
            headers=headers,
            timeout=60,
        )

        ok = r.status_code == expect

        if ok:
            status = "OK"
        else:
            try:
                detail = r.json().get("detail", "")[:80]
            except Exception:
                detail = r.text[:80]

            status = f"FAIL({r.status_code}) {detail}"

        results.append((name, status))

    except Exception as e:
        results.append(
            (name, f"FAIL(TIMEOUT): {str(e)[:80]}")
        )


def login(email, password):
    if not email or not password:
        print("  Login skipped: credentials not configured")
        return None

    try:
        r = requests.post(
            f"{BASE}/auth/login",
            json={
                "email": email,
                "password": password,
            },
            timeout=60,
        )

        if r.status_code == 200:
            return r.json().get("access_token")

    except Exception as e:
        print(f"  Login failed: {e}")

    return None


print("=== LOGGING IN ALL ROLES ===")

roles = {
    "business_owner": login(
        os.getenv("TEST_OWNER_EMAIL"),
        os.getenv("TEST_OWNER_PASSWORD"),
    ),
    "store_manager": login(
        os.getenv("TEST_MANAGER_EMAIL"),
        os.getenv("TEST_MANAGER_PASSWORD"),
    ),
    "sales_executive": login(
        os.getenv("TEST_SALES_EMAIL"),
        os.getenv("TEST_SALES_PASSWORD"),
    ),
    "admin": login(
        os.getenv("TEST_ADMIN_EMAIL"),
        os.getenv("TEST_ADMIN_PASSWORD"),
    ),
}

for role, token in roles.items():
    print(f"  {role}: {'OK' if token else 'FAILED'}")


owner = roles["business_owner"]
manager = roles["store_manager"]
sales = roles["sales_executive"]
admin = roles["admin"]

if not owner:
    print("FATAL: Cannot login as business_owner. Aborting.")
    sys.exit(1)


# Auth
print("\n=== AUTH ===")

test(
    "GET /auth/me (owner)",
    "get",
    f"{BASE}/auth/me",
    owner,
    expect=200,
)

test(
    "GET /auth/me (no token)",
    "get",
    f"{BASE}/auth/me",
    None,
    expect=401,
)


# Core CRUD
print("\n=== CORE CRUD (owner) ===")

for ep in [
    "/sales/",
    "/inventory/products",
    "/customers/",
    "/invoices/",
    "/categories/",
    "/suppliers/",
]:
    test(
        f"GET {ep}",
        "get",
        f"{BASE}{ep}",
        owner,
        expect=200,
    )


# Analytics
print("\n=== ANALYTICS ===")

test(
    "GET /analytics/kpis",
    "get",
    f"{BASE}/analytics/kpis",
    owner,
    expect=200,
)

test(
    "GET /analytics/pulse",
    "get",
    f"{BASE}/analytics/pulse",
    owner,
    expect=200,
)


# AI - owner
print("\n=== AI ENDPOINTS (owner) ===")

test(
    "GET /ai/forecast",
    "get",
    f"{BASE}/ai/forecast",
    owner,
    expect=200,
)

test(
    "GET /ai/segmentation",
    "get",
    f"{BASE}/ai/segmentation",
    owner,
    expect=200,
)

test(
    "GET /ai/churn",
    "get",
    f"{BASE}/ai/churn",
    owner,
    expect=200,
)

test(
    "GET /ai/anomalies",
    "get",
    f"{BASE}/ai/anomalies",
    owner,
    expect=200,
)

test(
    "GET /ai/recommendations",
    "get",
    f"{BASE}/ai/recommendations",
    owner,
    expect=200,
)

test(
    "GET /ai/clv",
    "get",
    f"{BASE}/ai/clv",
    owner,
    expect=200,
)


# AI - sales
print("\n=== AI ENDPOINTS (sales_exec - expect 403) ===")

test(
    "GET /ai/forecast (sales)",
    "get",
    f"{BASE}/ai/forecast",
    sales,
    expect=403,
)

test(
    "GET /ai/churn (sales)",
    "get",
    f"{BASE}/ai/churn",
    sales,
    expect=403,
)

test(
    "GET /ai/anomalies (sales)",
    "get",
    f"{BASE}/ai/anomalies",
    sales,
    expect=403,
)


# Platform
print("\n=== PLATFORM ===")

test(
    "GET /audit/logs",
    "get",
    f"{BASE}/audit/logs",
    owner,
    expect=200,
)

test(
    "GET /activity/recent",
    "get",
    f"{BASE}/activity/recent",
    owner,
    expect=200,
)

test(
    "GET /activity/stats",
    "get",
    f"{BASE}/activity/stats",
    owner,
    expect=200,
)

test(
    "GET /activity/heatmap",
    "get",
    f"{BASE}/activity/heatmap",
    owner,
    expect=200,
)

test(
    "GET /notifications",
    "get",
    f"{BASE}/notifications",
    owner,
    expect=200,
)

test(
    "GET /datasets/",
    "get",
    f"{BASE}/datasets/",
    owner,
    expect=200,
)

test(
    "GET /inventory/alerts",
    "get",
    f"{BASE}/inventory/alerts",
    owner,
    expect=200,
)


# User data
print("\n=== USER DATA ===")

test(
    "GET /user-data/dashboard-layouts",
    "get",
    f"{BASE}/user-data/dashboard-layouts",
    owner,
    expect=200,
)

test(
    "GET /user-data/report-templates",
    "get",
    f"{BASE}/user-data/report-templates",
    owner,
    expect=200,
)

test(
    "GET /user-data/scheduled-reports",
    "get",
    f"{BASE}/user-data/scheduled-reports",
    owner,
    expect=200,
)


# Revenue prediction
print("\n=== REVENUE PREDICTION ===")

test(
    "POST /revenue/predict",
    "post",
    f"{BASE}/revenue/predict",
    owner,
    data={
        "category": "Groceries",
        "region": "Urban",
        "seasonality": 1.2,
        "demand_index": 1.1,
        "price_index": 1.0,
        "promotion_active": True,
    },
    expect=200,
)


# Store manager
print("\n=== STORE MANAGER ACCESS ===")

test(
    "GET /customers/ (manager)",
    "get",
    f"{BASE}/customers/",
    manager,
    expect=200,
)

test(
    "GET /ai/recommendations (manager)",
    "get",
    f"{BASE}/ai/recommendations",
    manager,
    expect=200,
)

test(
    "GET /ai/forecast (manager)",
    "get",
    f"{BASE}/ai/forecast",
    manager,
    expect=200,
)


# Sales executive
print("\n=== SALES EXEC ACCESS ===")

test(
    "GET /customers/ (sales)",
    "get",
    f"{BASE}/customers/",
    sales,
    expect=200,
)

test(
    "GET /ai/recommendations (sales)",
    "get",
    f"{BASE}/ai/recommendations",
    sales,
    expect=200,
)

test(
    "GET /users/ (sales)",
    "get",
    f"{BASE}/users/",
    sales,
    expect=403,
)


# Admin
print("\n=== ADMIN ACCESS ===")

test(
    "GET /users/ (admin)",
    "get",
    f"{BASE}/users/",
    admin,
    expect=200,
)

test(
    "GET /datasets/ (admin)",
    "get",
    f"{BASE}/datasets/",
    admin,
    expect=200,
)


# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

passed = sum(1 for _, s in results if s == "OK")
failed = sum(1 for _, s in results if s.startswith("FAIL"))

print(
    f"Total: {len(results)} | "
    f"Passed: {passed} | "
    f"Failed: {failed}"
)

if failed:
    print("\nFAILED TESTS:")

    for name, status in results:
        if status.startswith("FAIL"):
            print(f"  {name}: {status}")