"""Error handling and robustness across the API surface.

Malformed input, oversized payloads, missing resources and edge-case data
must all produce clean 4xx responses -- never 500s.
"""
import io
import pytest


class TestValidationError:
    def test_sale_missing_fields(self, client, owner_headers):
        res = client.post("/api/sales/", headers=owner_headers, json={"quantity": 1})
        assert res.status_code == 422

    def test_sale_negative_price(self, client, owner_headers):
        res = client.post("/api/sales/", headers=owner_headers, json={
            "unit_price": -10, "quantity": 1,
        })
        assert res.status_code == 422

    def test_revenue_rejects_unrealistic_values(self, client, owner_headers):
        res = client.post("/api/revenue/predict", headers=owner_headers, json={
            "category": "Groceries", "region": "South", "seasonality": "Summer",
            "demand": 5_000_000, "price": 50, "promotion": "No",
        })
        assert res.status_code == 422

    def test_malformed_json_body(self, client, owner_headers):
        res = client.post(
            "/api/revenue/predict",
            headers={**owner_headers, "Content-Type": "application/json"},
            content=b"{not valid json",
        )
        assert res.status_code == 422

    def test_register_duplicate_email(self, client, seeded_business):
        res = client.post("/api/auth/register", json={
            "company_name": "Dup", "name": "Dup",
            "email": "owner@test.com", "password": "Whatever@1",
            "role": "business_owner",
        })
        assert res.status_code == 400


class TestMissingResources:
    def test_unknown_sale_update(self, client, owner_headers):
        res = client.delete("/api/sales/999999", headers=owner_headers)
        assert res.status_code in (404, 405)

    def test_unknown_scheduled_report(self, client, owner_headers):
        res = client.delete("/api/user-data/scheduled-reports/999999", headers=owner_headers)
        assert res.status_code == 404

    def test_run_unknown_scheduled_report(self, client, owner_headers):
        res = client.post("/api/user-data/scheduled-reports/999999/run", headers=owner_headers)
        assert res.status_code == 404

    def test_runs_of_unknown_scheduled_report(self, client, owner_headers):
        res = client.get("/api/user-data/scheduled-reports/999999/runs", headers=owner_headers)
        assert res.status_code == 404

    def test_unknown_user_removal(self, client, owner_headers):
        res = client.delete("/api/users/999999", headers=owner_headers)
        assert res.status_code == 404


class TestCRUDFlow:
    """A happy-path smoke test through the core CRUD endpoints."""

    def test_customer_product_sale_invoice_flow(self, client, owner_headers):
        # Create customer
        res = client.post("/api/customers/", headers=owner_headers, json={
            "name": "Flow Test", "email": "flow@test.com",
        })
        assert res.status_code == 201, res.text
        cid = res.json()["id"]

        # Create product
        res = client.post("/api/inventory/products", headers=owner_headers, json={
            "name": "Flow Product", "price": 42.0, "stock_quantity": 100,
            "reorder_threshold": 5,
        })
        assert res.status_code == 201, res.text
        pid = res.json()["id"]

        # Record a sale
        res = client.post("/api/sales/", headers=owner_headers, json={
            "customer_id": cid, "product_id": pid,
            "quantity": 2, "unit_price": 42.0,
        })
        assert res.status_code == 201, res.text
        assert res.json()["total_amount"] == 84.0

        # Create an invoice
        res = client.post("/api/invoices/", headers=owner_headers, json={
            "customer_id": cid, "amount": 84.0, "status": "pending",
        })
        assert res.status_code in (200, 201), res.text

    def test_report_run_end_to_end(self, client, owner_headers):
        """Scheduled reports: create -> run -> verify history."""
        res = client.post("/api/user-data/scheduled-reports", headers=owner_headers, json={
            "report_type": "sales-summary", "frequency": "daily",
            "format": "pdf", "recipients": ["boss@test.com"], "enabled": True,
        })
        assert res.status_code == 200, res.text
        rid = res.json()["id"]

        # Listing must include a real next_run
        listing = client.get("/api/user-data/scheduled-reports", headers=owner_headers).json()
        entry = next(r for r in listing if r["id"] == rid)
        assert entry["next_run"], "next_run must be computed, not null"

        # Run it now
        run = client.post(f"/api/user-data/scheduled-reports/{rid}/run", headers=owner_headers)
        assert run.status_code == 200
        body = run.json()
        assert body["status"] == "success"
        assert body["report"]["report_type"] == "sales-summary"
        assert "total_revenue" in body["report"]

        # History must show the run
        runs = client.get(f"/api/user-data/scheduled-reports/{rid}/runs", headers=owner_headers)
        assert runs.status_code == 200
        history = runs.json()
        assert any(r["id"] == body["run_id"] for r in history)

        # Clean up
        assert client.delete(f"/api/user-data/scheduled-reports/{rid}", headers=owner_headers).status_code == 200


class TestPaginationAndParams:
    def test_sales_pagination(self, client, owner_headers):
        res = client.get("/api/sales/?limit=5&offset=0", headers=owner_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["limit"] == 5
        assert len(body["items"]) <= 5

    def test_prediction_history_limit_capped(self, client, owner_headers):
        res = client.get("/api/user-data/prediction-history?limit=500", headers=owner_headers)
        assert res.status_code == 422  # le=200 cap enforced
