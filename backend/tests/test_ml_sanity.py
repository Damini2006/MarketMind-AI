"""ML sanity: accuracies are plausible, recommendations differ per customer,
forecast trends agree with the data's direction, revenue factors sum exactly."""
import datetime as _dt

import pytest


class TestChurnModel:
    def test_accuracy_is_honest(self, client, owner_headers):
        """The headline churn accuracy must be a real predictive score --
        never the degenerate 100% the old in-sample evaluation produced."""
        res = client.get("/api/ai/churn", headers=owner_headers)
        assert res.status_code == 200
        body = res.json()
        acc = body.get("accuracy")
        if acc is not None:
            assert acc < 1.0, "accuracy must not be a self-fulfilling 100%"
            assert acc >= 0.9, (
                "cross-validated churn accuracy collapsed — model selection must "
                "serve the best candidate (seeded tenant measures 0.95, the "
                "honest 19/20 ceiling for 20 customers)"
            )
            assert body.get("precision") is not None
            assert body.get("f1") is not None

    def test_rows_have_risk_and_recommendation(self, client, owner_headers):
        res = client.get("/api/ai/churn", headers=owner_headers)
        assert res.status_code == 200
        rows = res.json()["rows"]
        assert rows, "seeded business has plenty of churn-eligible customers"
        for row in rows:
            assert 0.0 <= row["churn_probability"] <= 1.0
            assert row["risk_category"] in ("High", "Medium", "Low")
            assert row["recommendation"]  # non-empty per-customer text

    def test_probabilities_differ_between_customers(self, client, owner_headers):
        """Identical probabilities for whole groups is the old RF-collision bug."""
        res = client.get("/api/ai/churn", headers=owner_headers)
        rows = res.json()["rows"]
        probs = {r["churn_probability"] for r in rows}
        assert len(probs) >= 3, f"expected varied probabilities, got {probs}"

    def test_not_everyone_flagged_high_risk(self, client, owner_headers):
        """The 'every customer is High risk' regression.

        Caused by customer-less sales (CSV uploads stamped "now") dragging
        the churn reference date forward, inflating every real customer's
        recency past their cadence. Also guards the no-signal path: a model
        that cannot beat chance must be replaced by the cadence fallback,
        and that fallback must not saturate the whole book into one tier.
        """
        res = client.get("/api/ai/churn", headers=owner_headers)
        assert res.status_code == 200
        rows = res.json()["rows"]
        assert rows
        cats = [r["risk_category"] for r in rows]
        high_share = cats.count("High") / len(cats)
        assert high_share <= 0.6, (
            f"{cats.count('High')}/{len(cats)} customers flagged High — the "
            "reference-date anchor or the no-signal guard regressed"
        )


class TestRecommendations:
    def test_not_every_customer_gets_the_same_products(self, client, owner_headers):
        """The 'everyone sees the same list' regression test."""
        res = client.get("/api/ai/recommendations", headers=owner_headers)
        assert res.status_code == 200
        rows = res.json()["rows"]
        assert len(rows) >= 2, "need multiple customers to verify variety"
        product_sets = [tuple(sorted(r["recommended_products"])) for r in rows]
        unique = set(product_sets)
        assert len(unique) > 1, (
            "every customer received identical recommendations: "
            f"{product_sets[:3]}"
        )

    def test_each_row_has_reason(self, client, owner_headers):
        res = client.get("/api/ai/recommendations", headers=owner_headers)
        for row in res.json()["rows"]:
            assert row["reason"]
            assert row["recommended_products"]


class TestForecast:
    def test_increasing_data_reported_increasing(self, client, owner_headers):
        """The seeded history trends upward; trend/growth must agree."""
        res = client.get("/api/ai/forecast?horizon_days=14", headers=owner_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["trend"] in ("increasing", "stable", "decreasing")
        # Seeded data grows ~40% over 90 days -> should NOT read "decreasing".
        assert body["trend"] != "decreasing", (
            f"growing data mislabelled decreasing (growth={body['growth_pct']}%)"
        )
        if body["growth_pct"] is not None:
            assert body["growth_pct"] >= -5, "growth should not be strongly negative"

    def test_forecast_returns_horizon_and_metrics(self, client, owner_headers):
        res = client.get("/api/ai/forecast?horizon_days=7", headers=owner_headers)
        body = res.json()
        assert len(body["forecast"]) == 7
        assert body["history"], "history should be non-empty"
        # First forecast day is the day after the last history day.
        last_hist = _dt.date.fromisoformat(body["history"][-1]["date"])
        first_fc = _dt.date.fromisoformat(body["forecast"][0]["period"])
        assert (first_fc - last_hist).days == 1

    def test_empty_business_gets_insufficient_data(self, client, fresh_business):
        token = client.post("/api/auth/login", json={
            "email": fresh_business["email"], "password": fresh_business["password"],
        }).json()["access_token"]
        res = client.get("/api/ai/forecast", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["trend"] == "insufficient_data"


class TestRevenuePrediction:
    PAYLOAD = {
        "category": "Groceries", "region": "South", "seasonality": "Summer",
        "demand": 100, "price": 50, "promotion": "No",
    }

    def test_explanation_sums_exactly_to_prediction(self, client, owner_headers):
        pred = client.post("/api/revenue/predict", json=self.PAYLOAD, headers=owner_headers).json()
        expl = client.post("/api/revenue/explain", json=self.PAYLOAD, headers=owner_headers).json()
        assert abs(pred["predicted_revenue"] - expl["predicted_revenue"]) < 0.05, (
            "explain endpoint must use the same model as predict"
        )
        factor_sum = sum(f["value"] for f in expl["factors"])
        assert abs(factor_sum - expl["predicted_revenue"]) < 0.05, (
            f"factors sum {factor_sum} != prediction {expl['predicted_revenue']}"
        )

    def test_prediction_is_deterministic(self, client, owner_headers):
        """No Math.random() anywhere: same input, same output."""
        a = client.post("/api/revenue/predict", json=self.PAYLOAD, headers=owner_headers).json()
        b = client.post("/api/revenue/predict", json=self.PAYLOAD, headers=owner_headers).json()
        assert a["predicted_revenue"] == b["predicted_revenue"]

    def test_validation_rejects_bad_input(self, client, owner_headers):
        res = client.post("/api/revenue/predict", json={
            **self.PAYLOAD, "demand": -5,
        }, headers=owner_headers)
        assert res.status_code == 422

    def test_free_text_seasonality_is_mapped_not_garbage(self, client, owner_headers):
        res = client.post("/api/revenue/predict", json={
            **self.PAYLOAD, "seasonality": "Festival",
        }, headers=owner_headers)
        body = res.json()
        assert body["inputs_used"]["seasonality"] in ("Winter", "Spring", "Summer", "Autumn")
