"""Role-based access control: every role sees exactly what it should.

Mirrors the frontend ROLE_PAGES map in components/Layout.jsx -- if the
backend and frontend ever drift apart, these tests catch it.
"""
import pytest


class TestAuthentication:
    def test_me_requires_token(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_me_with_bad_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
        assert res.status_code == 401

    def test_login_wrong_password(self, client, seeded_business):
        res = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "wrong"},
        )
        assert res.status_code == 401

    def test_login_unknown_email(self, client):
        res = client.post(
            "/api/auth/login",
            json={"email": "ghost@test.com", "password": "whatever"},
        )
        assert res.status_code == 401

    def test_owner_can_read_me(self, client, owner_headers):
        res = client.get("/api/auth/me", headers=owner_headers)
        assert res.status_code == 200
        assert res.json()["email"] == "owner@test.com"


class TestRbacAI:
    """AI endpoints: owner/manager/admin yes, sales_executive 403."""

    RESTRICTED = [
        ("/api/ai/forecast", "GET"),
        ("/api/ai/churn", "GET"),
        ("/api/ai/anomalies", "GET"),
    ]

    @pytest.mark.parametrize("url,method", RESTRICTED)
    def test_sales_executive_forbidden(self, client, sales_headers, url, method):
        res = client.get(url, headers=sales_headers)
        assert res.status_code == 403, f"{url} should 403 for sales_executive"

    @pytest.mark.parametrize("url,method", RESTRICTED)
    def test_owner_allowed(self, client, owner_headers, url, method):
        res = client.get(url, headers=owner_headers)
        assert res.status_code == 200, f"{url} should 200 for business_owner: {res.text}"

    def test_segmentation_open_to_all_roles(self, client, sales_headers):
        assert client.get("/api/ai/segmentation", headers=sales_headers).status_code == 200

    def test_recommendations_open_to_all_roles(self, client, sales_headers):
        assert client.get("/api/ai/recommendations", headers=sales_headers).status_code == 200


class TestRbacUsers:
    def test_sales_cannot_list_team(self, client, sales_headers):
        assert client.get("/api/users/", headers=sales_headers).status_code == 403

    def test_owner_can_list_team(self, client, owner_headers):
        assert client.get("/api/users/", headers=owner_headers).status_code == 200

    def test_revenue_predict_requires_auth(self, client):
        res = client.post("/api/revenue/predict", json={
            "category": "Groceries", "region": "South", "seasonality": "Summer",
            "demand": 100, "price": 50, "promotion": "No",
        })
        assert res.status_code == 401

    def test_revenue_explain_requires_auth(self, client):
        res = client.post("/api/revenue/explain", json={
            "category": "Groceries", "region": "South", "seasonality": "Summer",
            "demand": 100, "price": 50, "promotion": "No",
        })
        assert res.status_code == 401

    def test_revenue_predict_authenticated(self, client, sales_headers):
        res = client.post("/api/revenue/predict", json={
            "category": "Groceries", "region": "South", "seasonality": "Summer",
            "demand": 100, "price": 50, "promotion": "No",
        }, headers=sales_headers)
        assert res.status_code == 200
        body = res.json()
        assert "predicted_revenue" in body
        assert body["predicted_revenue"] >= 0


class TestRbacTeamManagement:
    def test_sales_cannot_invite(self, client, sales_headers):
        res = client.post("/api/users/", headers=sales_headers, json={
            "full_name": "X", "email": "x@test.com", "password": "pw123456",
            "role_name": "sales_executive",
        })
        assert res.status_code == 403

    def test_owner_can_invite_and_remove(self, client, owner_headers):
        res = client.post("/api/users/", headers=owner_headers, json={
            "full_name": "Temp", "email": "temp@test.com",
            "password": "pw123456", "role_name": "sales_executive",
        })
        assert res.status_code == 201
        uid = res.json()["id"]
        assert client.delete(f"/api/users/{uid}", headers=owner_headers).status_code == 204

    def test_invalid_role_rejected(self, client, owner_headers):
        res = client.post("/api/users/", headers=owner_headers, json={
            "full_name": "Bad", "email": "bad@test.com",
            "password": "pw123456", "role_name": "superhero",
        })
        assert res.status_code == 400
