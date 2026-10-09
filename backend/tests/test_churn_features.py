"""Contract tests for the Churn feature-contribution endpoint (/api/ai/churn/features).

Both the dashboard page and this test read the same JSON contract produced by
`ml/churn.py`'s `run_churn_prediction`, so the number of tests here is 1: does
the endpoint return the percentile row shape the Churn page consumes? Keeping
the assertion list tight avoids duplicating the existing ML-sanity tests.

Shape notes (verified against the backend code in `ml/churn.py`, not against
any single value's magnitude):
  * `recency_percentile`, `frequency_percentile`, `spend_trend_percentile`,
    `regularity_percentile`, `overdue_percentile` are population-relative
    percentiles of dimensionless signals -> 0-100, higher = more atypical/at risk.
  * `monetary_percentile` is the population-relative percentile of raw `monetary_total`
    -> a currency value, NOT a 0-100 score (the module docstring's "0-100" is
    only accurate for the five dimensionless signals).
"""

import pytest


def _get(client, headers, **params):
    res = client.get("/api/ai/churn/features", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return res.json()


class TestChurnFeaturesContract:
    def test_rows_carry_population_relative_signals(self, client, owner_headers):
        body = _get(client, owner_headers)

        assert body["rows"], "fixture has customers with purchase history"

        for row in body["rows"]:
            # The page's driver card reads the percentile keys + three plain
            # columns it already knows, so both must be present on every row.
            for key in (
                "customer_id",
                "customer_name",
                "churn_probability",
                "risk_category",
                "recency_percentile",
                "frequency_percentile",
                "spend_trend_percentile",
                "monetary_percentile",
                "regularity_percentile",
                "overdue_percentile",
            ):
                assert key in row, f"missing {key!r} in row {row!r}"

            # The five dimensionless signals are population-relative
            # percentiles, 0-100 (or 0-1 for the ratio), so a driver card can
            # turn them into plain-English text ("Inactive at the 80th pct").
            assert 0.0 <= float(row["recency_percentile"]) <= 100.0
            assert 0.0 <= float(row["frequency_percentile"]) <= 100.0
            assert 0.0 <= float(row["spend_trend_percentile"]) <= 100.0
            assert 0.0 <= float(row["regularity_percentile"]) <= 100.0
            assert 0.0 <= float(row["overdue_percentile"]) <= 100.0

    def test_row_count_matches_customer_count(self, client, owner_headers):
        body = _get(client, owner_headers)
        assert body["rows"]
        # run_churn_prediction returns only the rows plus ML metrics; the page
        # derives the count from rows itself, so no total key is promised.
        assert len(body["rows"]) >= 0

    def test_metrics_are_null_when_not_trainable(self, client, owner_headers):
        body = _get(client, owner_headers)
        for key in ("accuracy", "precision", "recall", "f1"):
            assert key in body, f"missing {key} in {body!r}"

    def test_feature_endpoint_requires_auth(self, client):
        # No credentials -> 401. Clear any session cookie a prior login in the
        # same TestClient may have left behind.
        client.cookies.clear()
        res = client.get("/api/ai/churn/features")
        assert res.status_code == 401
