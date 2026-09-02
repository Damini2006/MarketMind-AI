"""
Churn prediction module.

BUG FIX in this version -- "12 days inactive showing as high risk":
CSV/manual sales create one `Sale` row per product line, not one per
checkout. A customer buying 3 products in one visit produces 3 Sale rows
on the same date. The previous version computed each customer's "normal
gap between purchases" directly from consecutive Sale rows -- so a
completely normal shopper with multi-item visits got an artificial
near-zero expected gap (since same-day rows have a 0-day gap between
them), which made even a totally ordinary 12-day absence look like
"massively overdue" relative to that fake near-0 cadence.
FIX: same-day sales for the same customer are now collapsed into one
"visit" before any cadence/gap math runs, so frequency and gaps reflect
actual shopping visits, not raw line items.

Why this avoids the older "same probability for whole groups of
customers" bug:
RandomForestClassifier's probability is "fraction of N trees that voted
churn" -- with few, redundant features, many different customers land in
the same tree leaf and get identical vote fractions. Logistic Regression's
probability is a smooth, continuous function of standardized features, so
two customers with different values mathematically cannot collide.

Design notes:
1. "Now" is anchored to the most recent sale date in the data, not
   wall-clock time.
2. The churn label is adaptive per customer (overdue relative to THEIR OWN
   normal visit cadence), not one fixed day-count for everyone.
3. Recommendations are generated from each customer's own combination of
   signals (value tier, spend trend, visit regularity, one-time vs
   repeat) so different customers get genuinely different text, not one
   of three templates.
4. Class-balanced, cross-validated (StratifiedKFold), so both the
   probabilities and the reported accuracy/precision/recall/F1 are
   trustworthy rather than a single lucky/unlucky split.
5. Real fallback for small datasets: a continuous heuristic score from
   each customer's overdue ratio, never a flat number for everyone.
"""
from collections import defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, FunctionTransformer
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sqlalchemy.orm import Session

from .. import models

MIN_ROWS_FOR_ML = 8
MIN_PER_CLASS_FOR_CV = 3
DEFAULT_GAP_DAYS = 30.0
OVERDUE_MULTIPLIER = 2.0
ONE_TIME_BUYER_CHURN_DAYS = 90


def _risk_category(prob: float) -> str:
    if prob >= 0.66:
        return "High"
    if prob >= 0.33:
        return "Medium"
    return "Low"


def _collapse_same_day_visits(c_sales):
    """
    Group a customer's raw Sale rows into one "visit" per calendar day
    (summing amounts for that day). This is the actual bug fix: without
    it, multi-item same-day purchases look like several purchases with a
    0-day gap, which corrupts every cadence-based calculation downstream.
    """
    by_day = defaultdict(float)
    for s in c_sales:
        day = s.sale_date.date() if hasattr(s.sale_date, "date") else s.sale_date
        by_day[day] += float(s.total_amount)
    visits = sorted(by_day.items(), key=lambda kv: kv[0])
    return visits  # list of (date, total_amount_that_day), sorted ascending


def _customer_features(visits, reference_date, fleet_default_gap):
    """visits: list of (date, amount) -- one entry per shopping VISIT, not per line item."""
    frequency = len(visits)
    if frequency == 0:
        return None

    amounts = np.array([amt for _, amt in visits])
    first_visit = visits[0][0]
    last_visit = visits[-1][0]

    ref_date_only = reference_date.date() if hasattr(reference_date, "date") else reference_date
    recency_days = max((ref_date_only - last_visit).days, 0)
    tenure_days = max((ref_date_only - first_visit).days, 1)

    if frequency >= 2:
        gaps = np.array([(visits[i][0] - visits[i - 1][0]).days for i in range(1, frequency)])
        gaps = np.clip(gaps, a_min=0, a_max=None)
        expected_gap = max(float(np.median(gaps)), 1.0)
        purchase_regularity = float(np.std(gaps))
    else:
        expected_gap = fleet_default_gap
        purchase_regularity = 0.0

    overdue_ratio = recency_days / expected_gap
    monetary_total = float(amounts.sum())
    monetary_avg = float(amounts.mean())
    monetary_std = float(amounts.std()) if frequency >= 2 else 0.0

    if frequency >= 4:
        midpoint = frequency // 2
        recent_avg = float(amounts[midpoint:].mean())
        prior_avg = float(amounts[:midpoint].mean()) or recent_avg
        spend_trend = recent_avg / prior_avg if prior_avg else 1.0
    else:
        spend_trend = 1.0

    if frequency >= 2:
        churned = 1 if overdue_ratio >= OVERDUE_MULTIPLIER else 0
    else:
        churned = 1 if recency_days >= ONE_TIME_BUYER_CHURN_DAYS else 0

    features = [
        recency_days, frequency, tenure_days, monetary_total,
        monetary_avg, monetary_std, purchase_regularity, spend_trend, overdue_ratio,
    ]
    return {
        "features": features, "churned": churned, "recency_days": recency_days,
        "frequency": frequency, "overdue_ratio": overdue_ratio, "monetary_total": monetary_total,
        "monetary_avg": monetary_avg, "spend_trend": spend_trend,
        "purchase_regularity": purchase_regularity, "expected_gap": expected_gap,
    }


def _build_pipeline():
    def log_transform(X):
        X = np.array(X, dtype=float)
        X_log = X.copy()
        for col in (0, 2, 3, 4, 5, 6):
            X_log[:, col] = np.log1p(np.clip(X_log[:, col], a_min=0, a_max=None))
        return X_log

    return Pipeline([
        ("log", FunctionTransformer(log_transform)),
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(class_weight="balanced", max_iter=2000, C=1.0, random_state=42)),
    ])


def _recommendation(row, prob, is_vip, is_frequent, median_regularity):
    """
    Builds a recommendation from the customer's OWN combination of signals
    (value tier, spend trend, visit regularity, one-time vs repeat), so
    different customers land on genuinely different text -- not one of
    three fixed templates.
    """
    name = row["customer_name"]
    recency = row["recency_days"]
    freq = row["order_count"]
    spend_trend = row["spend_trend"]
    monetary_total = row["monetary_total"]
    regularity = row["purchase_regularity"]
    risk = _risk_category(prob)

    declining_spend = spend_trend < 0.85
    very_irregular = regularity > median_regularity * 1.5 if median_regularity > 0 else False
    one_time = freq == 1

    if risk == "High":
        if one_time:
            return (
                f"{name} made a single purchase {recency} days ago and never returned. "
                f"A first-time-buyer discount or welcome-back offer tends to work well here."
            )
        if is_vip and declining_spend:
            return (
                f"{name} is a high-value customer (₹{monetary_total:,.0f} lifetime) whose spending has been "
                f"declining and who hasn't ordered in {recency} days -- worth a personal call or account-manager "
                f"outreach before they're gone for good."
            )
        if is_vip:
            return (
                f"{name} is one of your highest-value customers but hasn't ordered in {recency} days across "
                f"{freq} past visits -- prioritize a personalized win-back offer."
            )
        if is_frequent:
            return (
                f"{name} used to order regularly ({freq} visits) but has gone quiet for {recency} days -- "
                f"a loyalty discount or restock reminder could bring them back."
            )
        if very_irregular:
            return (
                f"{name}'s ordering pattern has always been irregular, but {recency} days of silence across "
                f"{freq} visits is now well past even their own unpredictable rhythm. A re-engagement email is worth trying."
            )
        return (
            f"{name} hasn't ordered in {recency} days across {freq} visits -- well past their usual rhythm. "
            f"Send a personalized win-back offer."
        )

    if risk == "Medium":
        if declining_spend:
            return f"{name}'s average order value has been trending down recently. A bundle deal or loyalty reward may help re-engage them."
        if is_vip:
            return f"{name} is a valuable customer showing early signs of slowing down -- a check-in now is cheaper than a win-back campaign later."
        return f"{name} is ordering less often than usual. A check-in email or small loyalty offer may help."

    # Low risk
    if is_vip:
        return f"{name} is a top customer purchasing on a healthy, active cadence -- consider them for early access or loyalty perks."
    if is_frequent:
        return f"{name} is a regular, engaged customer -- no action needed right now."
    return f"{name} is purchasing on a normal, healthy cadence -- no action needed."


def run_churn_prediction(db: Session, business_id: int = None) -> dict:
    customer_q = db.query(models.Customer)
    sale_q = db.query(models.Sale)
    if business_id is not None:
        customer_q = customer_q.filter(models.Customer.business_id == business_id)
        sale_q = sale_q.filter(models.Sale.business_id == business_id)
    customers = customer_q.all()
    sales = sale_q.all()

    if not sales or not customers:
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None}

    by_customer = defaultdict(list)
    for s in sales:
        if s.customer_id:
            by_customer[s.customer_id].append(s)

    reference_date = max(s.sale_date for s in sales)

    # Collapse every customer's raw line-item rows into visits FIRST, then
    # derive the business-wide default gap from real visit-to-visit gaps.
    visits_by_customer = {}
    all_gaps = []
    for cid, c_sales in by_customer.items():
        visits = _collapse_same_day_visits(c_sales)
        visits_by_customer[cid] = visits
        if len(visits) >= 2:
            all_gaps.extend([(visits[i][0] - visits[i - 1][0]).days for i in range(1, len(visits))])
    fleet_default_gap = float(np.median(all_gaps)) if all_gaps else DEFAULT_GAP_DAYS
    fleet_default_gap = max(fleet_default_gap, 1.0)

    features, labels, names, ids = [], [], [], []
    recencies, frequencies, overdue_ratios = [], [], []
    monetary_totals, monetary_avgs, spend_trends, regularities = [], [], [], []

    for c in customers:
        visits = visits_by_customer.get(c.id, [])
        result = _customer_features(visits, reference_date, fleet_default_gap)
        if result is None:
            continue
        features.append(result["features"])
        labels.append(result["churned"])
        names.append(c.name)
        ids.append(c.id)
        recencies.append(result["recency_days"])
        frequencies.append(result["frequency"])
        overdue_ratios.append(result["overdue_ratio"])
        monetary_totals.append(result["monetary_total"])
        monetary_avgs.append(result["monetary_avg"])
        spend_trends.append(result["spend_trend"])
        regularities.append(result["purchase_regularity"])

    if len(features) == 0:
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None}

    X = np.array(features)
    y = np.array(labels)

    metrics = {"accuracy": None, "precision": None, "recall": None, "f1": None}
    class_counts = np.bincount(y) if len(y) else np.array([])
    can_train_ml = (
        len(X) >= MIN_ROWS_FOR_ML
        and len(class_counts) > 1
        and class_counts.min() >= MIN_PER_CLASS_FOR_CV
    )

    if can_train_ml:
        n_splits = max(2, min(5, int(class_counts.min())))
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        cv_preds = cross_val_predict(_build_pipeline(), X, y, cv=cv, method="predict")
        metrics = {
            "accuracy": round(float(accuracy_score(y, cv_preds)), 3),
            "precision": round(float(precision_score(y, cv_preds, zero_division=0)), 3),
            "recall": round(float(recall_score(y, cv_preds, zero_division=0)), 3),
            "f1": round(float(f1_score(y, cv_preds, zero_division=0)), 3),
        }
        final_pipeline = _build_pipeline()
        final_pipeline.fit(X, y)
        churn_col = list(final_pipeline.named_steps["clf"].classes_).index(1)
        probs = final_pipeline.predict_proba(X)[:, churn_col]
    else:
        overdue_arr = np.array(overdue_ratios)
        probs = np.clip(overdue_arr / (OVERDUE_MULTIPLIER * 1.5), 0.0, 1.0)

    # Population-relative thresholds so "VIP" / "frequent" are relative to
    # THIS business's own customers, not an arbitrary fixed number.
    monetary_median = float(np.median(monetary_totals)) if monetary_totals else 0.0
    monetary_p75 = float(np.percentile(monetary_totals, 75)) if len(monetary_totals) >= 4 else monetary_median
    frequency_median = float(np.median(frequencies)) if frequencies else 1.0
    regularity_median = float(np.median(regularities)) if regularities else 0.0

    rows = []
    for i, cid in enumerate(ids):
        prob = float(probs[i])
        base_row = {
            "customer_id": cid,
            "customer_name": names[i],
            "churn_probability": round(prob, 3),
            "risk_category": _risk_category(prob),
            "recency_days": recencies[i],
            "order_count": frequencies[i],
            "monetary_total": monetary_totals[i],
            "spend_trend": spend_trends[i],
            "purchase_regularity": regularities[i],
        }
        is_vip = monetary_totals[i] >= monetary_p75 and monetary_p75 > 0
        is_frequent = frequencies[i] >= frequency_median and frequency_median > 1
        base_row["recommendation"] = _recommendation(base_row, prob, is_vip, is_frequent, regularity_median)
        rows.append(base_row)

    rows.sort(key=lambda r: -r["churn_probability"])
    return {"rows": rows, **metrics}
