"""Tenant isolation and the new-user experience.

A freshly registered business must see NO data -- no demo customers, no
stray sales, no leaked forecasts -- while the seeded demo business keeps
its history.
"""
import pytest


class TestNewUserEmptyState:
    def _auth(self, client, fresh_business):
        res = client.post("/api/auth/login", json={
            "email": fresh_business["email"],
            "password": fresh_business["password"],
        })
        assert res.status_code == 200
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_registration_creates_empty_business(self, client):
        """Sign-up flow end-to-end: new users must not inherit demo data."""
        import uuid
        email = f"newbie-{uuid.uuid4().hex[:8]}@test.com"
        res = client.post("/api/auth/register", json={
            "company_name": "Brand New Co",
            "name": "New Owner",
            "email": email,
            "password": "Newbie@123",
            "role": "business_owner",
        })
        assert res.status_code == 201, res.text

        login = client.post("/api/auth/login", json={
            "email": email, "password": "Newbie@123",
        })
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # The new business must be completely empty:
        sales = client.get("/api/sales/", headers=headers).json()
        assert sales["total"] == 0, "new user must not see demo sales"

        customers = client.get("/api/customers/", headers=headers).json()
        assert customers == [], "new user must not see demo customers"

        products = client.get("/api/inventory/products", headers=headers).json()
        assert products == [], "new user must not see demo products"

        kpis = client.get("/api/analytics/kpis", headers=headers).json()
        assert kpis["total_revenue"] == 0
        assert kpis["total_sales"] == 0

    def test_existing_business_keeps_its_data(self, client, owner_headers):
        res = client.get("/api/analytics/kpis", headers=owner_headers)
        assert res.status_code == 200
        assert res.json()["total_sales"] > 0

    def test_tenant_cannot_read_other_tenants_data(self, client, fresh_business, owner_headers):
        """The fresh business's customer list must never contain the demo
        business's customers (and vice versa)."""
        other = client.get("/api/customers/", headers=owner_headers).json()
        assert other, "seeded business has customers"
        other_names = {c["name"] for c in other}

        headers = self._auth(client, fresh_business)
        mine = client.get("/api/customers/", headers=headers).json()
        my_names = {c["name"] for c in mine}
        assert my_names.isdisjoint(other_names), "cross-tenant data leak!"

    def test_ai_pages_graceful_on_empty_business(self, client, fresh_business):
        headers = self._auth(client, fresh_business)
        seg = client.get("/api/ai/segmentation", headers=headers)
        assert seg.status_code == 200
        assert seg.json()["segments"] == []

        churn = client.get("/api/ai/churn", headers=headers)
        assert churn.status_code == 200
        assert churn.json()["rows"] == []

        recs = client.get("/api/ai/recommendations", headers=headers)
        assert recs.status_code == 200
        assert recs.json()["rows"] == []
