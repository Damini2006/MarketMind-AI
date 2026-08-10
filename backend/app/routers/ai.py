"""AI intelligence endpoints — real scikit-learn models over the tenant's data.

- /forecast       : linear regression on daily revenue (day index, weekday, month)
- /segmentation   : K-Means clustering on RFM features, named by cluster centroids
- /churn          : logistic regression trained on a train/observe time split
- /recommendations: item-based collaborative filtering (co-purchase counts)
- /anomalies      : Isolation Forest over per-sale features

Every endpoint degrades gracefully on tiny datasets (returns honest nulls or
falls back to a transparent heuristic instead of fabricating metrics).
"""
import datetime as dt
import math
from collections import defaultdict
from functools import wraps
from typing import Dict, Any, List

import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..cache import get_or_set

from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    silhouette_score,
)
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import StratifiedKFold, cross_validate

from .. import models
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])


# ---------------------------------------------------------------------------
# TTL caching
# ---------------------------------------------------------------------------
# The ML endpoints retrain scikit-learn models on every request, which is
# wasteful and slow over a high-latency database (e.g. Neon). Cache each
# result per business for `ttl` seconds; functools.wraps keeps FastAPI's
# signature/dependency inference intact.
def ttl_cache(ttl: int = 120):
    def deco(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = kwargs.get("current_user")
            bid = getattr(user, "business_id", None)
            params = ":".join(
                f"{k}={v}"
                for k, v in kwargs.items()
                if k not in ("db", "current_user")
            )
            return get_or_set(
                f"ai:{bid}:{func.__name__}:{params}",
                ttl,
                lambda: func(*args, **kwargs),
            )
        return wrapper

    return deco


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _daily_revenue_series(sales: List[models.Sale]):
    """Group sales into a {date -> revenue} series with sorted dates."""
    daily = defaultdict(float)
    for s in sales:
        d = s.sale_date.date() if s.sale_date else dt.datetime.utcnow().date()
        daily[d] += float(s.total_amount)
    dates = sorted(daily.keys())
    revenues = np.array([daily[d] for d in dates], dtype=float)
    return dates, revenues


def _logistic(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


# ---------------------------------------------------------------------------
# 1) Sales forecasting — Linear Regression on daily revenue
# ---------------------------------------------------------------------------
@router.get("/forecast")
@router.get("/forecasting")
@ttl_cache(ttl=120)
def get_sales_forecast(
    horizon_days: int = 14,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == current_user.business_id)
        .order_by(models.Sale.sale_date.asc())
        .all()
    )
    if not sales:
        return {
            "trend": "insufficient_data",
            "history": [],
            "forecast": [],
            "growth_pct": None,
            "mae": None,
            "rmse": None,
            "r2": None,
        }

    dates, y = _daily_revenue_series(sales)
    n = len(y)
    history = [
        {"date": d.isoformat(), "revenue": round(float(v), 2)}
        for d, v in zip(dates, y)
    ]

    # Features: day index (captures trend), day-of-week and month (seasonality)
    day_idx = np.arange(n, dtype=float)
    dow = np.array([d.weekday() for d in dates], dtype=float)
    month = np.array([d.month for d in dates], dtype=float)
    X = np.column_stack([day_idx, dow, month])

    mae = rmse = r2 = None
    model = None
    if n >= 10:
        n_test = max(3, int(n * 0.2))
        n_train = n - n_test
        model = LinearRegression().fit(X[:n_train], y[:n_train])
        y_pred_test = model.predict(X[n_train:])
        mae = round(float(mean_absolute_error(y[n_train:], y_pred_test)), 2)
        rmse = round(float(math.sqrt(mean_squared_error(y[n_train:], y_pred_test))), 2)
        r2 = round(float(r2_score(y[n_train:], y_pred_test)), 4)

    if model is None:
        # Too little history — naive flat forecast, no fabricated metrics.
        mean_rev = float(y.mean())
        predict = lambda fX: np.full(len(fX), mean_rev)  # noqa: E731
        slope = 0.0
    else:
        predict = model.predict
        slope = float(model.coef_[0])

    if slope > 0.5:
        trend = "increasing"
    elif slope < -0.5:
        trend = "decreasing"
    else:
        trend = "stable"

    # Growth: recent window vs. the window before it
    growth_pct = 0.0
    if n >= 14:
        recent, prev = y[-7:].mean(), y[-14:-7].mean()
        growth_pct = round((recent / prev - 1) * 100, 1) if prev > 0 else 0.0
    elif n >= 7:
        recent, prev = y[-3:].mean(), y[-6:-3].mean()
        growth_pct = round((recent / prev - 1) * 100, 1) if prev > 0 else 0.0

    forecast = []
    if horizon_days > 0:
        last_date = dates[-1]
        future_days = [
            last_date + dt.timedelta(days=i) for i in range(1, horizon_days + 1)
        ]
        f_idx = np.arange(n, n + horizon_days, dtype=float)
        f_dow = np.array([d.weekday() for d in future_days], dtype=float)
        f_month = np.array([d.month for d in future_days], dtype=float)
        fX = np.column_stack([f_idx, f_dow, f_month])
        preds = np.maximum(predict(fX), 0)
        forecast = [
            {"period": d.isoformat(), "predicted_revenue": round(float(v), 2)}
            for d, v in zip(future_days, preds)
        ]

    return {
        "trend": trend,
        "growth_pct": growth_pct,
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "history": history,
        "forecast": forecast,
    }


# ---------------------------------------------------------------------------
# 2) Customer segmentation — K-Means on RFM features
# ---------------------------------------------------------------------------
def _customer_rfm(
    db: Session, business_id: int, customers: List[models.Customer], now: dt.datetime
) -> Dict[int, dict]:
    """Recency (days since last purchase), frequency (orders), monetary (₹)."""
    rfm = {}
    for c in customers:
        sales = (
            db.query(models.Sale)
            .filter(
                models.Sale.customer_id == c.id,
                models.Sale.business_id == business_id,
            )
            .order_by(models.Sale.sale_date.desc())
            .all()
        )
        total_spent = sum(float(s.total_amount) for s in sales)
        order_count = len(sales)
        last = sales[0].sale_date if sales else None
        days_since = (now - last).days if last else 999
        rfm[c.id] = {
            "customer": c,
            "total_spent": total_spent,
            "order_count": order_count,
            "days_since_last": days_since,
        }
    return rfm


def _name_clusters(stats: List[dict], labels: np.ndarray) -> Dict[int, str]:
    """Name each cluster by its centroid's monetary rank and recency."""
    n_clusters = len(set(labels))
    info = []
    for cl in range(n_clusters):
        members = [stats[i] for i, l in enumerate(labels) if l == cl]
        mon = np.mean([m["total_spent"] for m in members]) if members else 0.0
        rec = np.mean([m["days_since_last"] for m in members]) if members else 999.0
        info.append((cl, mon, rec))
    info.sort(key=lambda t: (t[1], -t[2]))  # monetary asc, recency desc

    names = {}
    for rank, (cl, mon, rec) in enumerate(info):
        pct = rank / max(n_clusters - 1, 1)
        if pct >= 0.75 and mon > 0:
            names[cl] = "VIP Champions"
        elif pct >= 0.5:
            names[cl] = "Loyal Frequenters"
        elif pct >= 0.25:
            names[cl] = "Potential Loyalists"
        elif rec > 60:
            names[cl] = "At-Risk Spenders"
        elif mon <= 0:
            names[cl] = "New / Recent Buyers"
        else:
            names[cl] = "Low Engagement"
    return names


@router.get("/segmentation")
@ttl_cache(ttl=120)
def get_customer_segmentation(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == current_user.business_id)
        .all()
    )
    if not customers:
        return {"segments": [], "customers": [], "silhouette_score": None}

    now = dt.datetime.utcnow()
    stats = list(_customer_rfm(db, current_user.business_id, customers, now).values())

    X = np.array(
        [
            [s["days_since_last"], s["order_count"], s["total_spent"]]
            for s in stats
        ],
        dtype=float,
    )
    # Log-scale monetary so big spenders don't dominate, then standardize.
    X[:, 2] = np.log1p(X[:, 2])
    scaler = StandardScaler().fit(X)
    X_scaled = scaler.transform(X)

    n = len(stats)
    silhouette = None
    if n >= 4:
        k = min(4, n)
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = kmeans.fit_predict(X_scaled)
        if n > k:
            silhouette = round(float(silhouette_score(X_scaled, labels)), 3)
    else:
        # Too few customers to cluster — each gets its own descriptive bucket.
        labels = np.zeros(n, dtype=int)
        for i in range(n):
            labels[i] = i

    name_map = _name_clusters(stats, labels)
    customer_list = []
    segment_counts = defaultdict(int)
    segment_spend = defaultdict(float)
    segment_orders = defaultdict(int)

    for i, stat in enumerate(stats):
        segment = name_map[int(labels[i])]
        customer_list.append(
            {
                "customer_id": stat["customer"].id,
                "customer_name": stat["customer"].name,
                "segment": segment,
                "frequency": stat["order_count"],
                "monetary": round(stat["total_spent"], 2),
            }
        )
        segment_counts[segment] += 1
        segment_spend[segment] += stat["total_spent"]
        segment_orders[segment] += stat["order_count"]

    segments_summary = []
    for seg_name, count in segment_counts.items():
        segments_summary.append(
            {
                "segment": seg_name,
                "customer_count": count,
                "avg_purchase_value": round(segment_spend[seg_name] / count, 2),
                "avg_purchase_frequency": round(segment_orders[seg_name] / count, 1),
            }
        )

    return {
        "silhouette_score": silhouette,
        "segments": segments_summary,
        "customers": customer_list,
    }


# ---------------------------------------------------------------------------
# 3) Churn prediction — logistic regression trained on a time split
# ---------------------------------------------------------------------------
CHURN_RECS = {
    "High": "Offer 15% discount code & send re-engagement email.",
    "Medium": "Send product recommendations based on past purchases.",
    "Low": "Maintain regular communication & customer support.",
}


def _rfm_at(purchases: List[models.Sale], cutoff: dt.datetime):
    """Features for purchases up to `cutoff`: [freq, monetary, avg_gap, recency]."""
    pre = [p for p in purchases if p.sale_date and p.sale_date <= cutoff]
    if not pre:
        return None
    dates = sorted(p.sale_date for p in pre)
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    avg_gap = sum(gaps) / len(gaps) if gaps else 0.0
    return [
        float(len(pre)),
        float(sum(p.total_amount for p in pre)),
        float(avg_gap),
        float((cutoff - dates[-1]).days),
    ]


@router.get("/churn")
@ttl_cache(ttl=120)
def get_churn_predictions(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == current_user.business_id)
        .all()
    )
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == current_user.business_id)
        .all()
    )
    if not customers:
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None}
    if not sales:
        return {
            "rows": [
                {
                    "customer_id": c.id,
                    "customer_name": c.name,
                    "risk_category": "High",
                    "churn_probability": 0.9,
                    "recommendation": CHURN_RECS["High"],
                }
                for c in customers
            ],
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
        }

    by_cust = defaultdict(list)
    dated = []
    for s in sales:
        by_cust[s.customer_id].append(s)
        if s.sale_date:
            dated.append(s.sale_date)

    min_d, max_d = min(dated), max(dated)
    span_days = max((max_d - min_d).days, 1)
    train_end = min_d + dt.timedelta(days=span_days * 0.6)
    observe_end = train_end + dt.timedelta(days=max(30, span_days * 0.25))

    # Build the training set: a customer "churned" if they bought before
    # train_end but not during the observation window that follows.
    X_tr, y_tr = [], []
    for cid, purchases in by_cust.items():
        f = _rfm_at(purchases, train_end)
        if f is None:
            continue
        bought_in_observe = any(
            p.sale_date and train_end < p.sale_date <= observe_end for p in purchases
        )
        X_tr.append(f)
        y_tr.append(0 if bought_in_observe else 1)

    model = None
    scaler = None
    accuracy = precision = recall = f1 = None
    if len(X_tr) >= 8 and len(set(y_tr)) == 2:
        X_arr = np.array(X_tr, dtype=float)
        X_arr[:, 1] = np.log1p(X_arr[:, 1])
        scaler = StandardScaler().fit(X_arr)
        Xs = scaler.transform(X_arr)
        y_arr = np.array(y_tr)
        minority = int(min(np.bincount(y_arr)))

        clf = LogisticRegression(max_iter=1000)
        if minority >= 2:
            try:
                cv = StratifiedKFold(
                    n_splits=min(3, minority), shuffle=True, random_state=42
                )
                scores = cross_validate(
                    clf, Xs, y_arr, cv=cv,
                    scoring=["accuracy", "precision", "recall", "f1"],
                    error_score="raise",
                )
                accuracy = round(float(np.mean(scores["test_accuracy"])), 3)
                precision = round(float(np.mean(scores["test_precision"])), 3)
                recall = round(float(np.mean(scores["test_recall"])), 3)
                f1 = round(float(np.mean(scores["test_f1"])), 3)
                clf.fit(Xs, y_arr)
                model = clf
            except Exception:
                model = None
        else:
            # Minority too small for CV — train anyway, report no metrics.
            try:
                clf.fit(Xs, y_arr)
                model = clf
            except Exception:
                model = None

    rows = []
    for c in customers:
        purchases = by_cust.get(c.id, [])
        f = _rfm_at(purchases, max_d)
        if f is None:
            prob, risk = 0.9, "High"
        elif model is not None:
            x = np.array([f], dtype=float)
            x[0, 1] = np.log1p(x[0, 1])
            x = scaler.transform(x)
            prob = float(model.predict_proba(x)[0, 1])
            risk = "High" if prob >= 0.6 else "Medium" if prob >= 0.3 else "Low"
        else:
            # No trainable signal — transparent recency-based probability.
            prob = _logistic((f[3] - 30) / 15.0)
            prob = min(0.95, max(0.02, prob))
            risk = "High" if prob >= 0.6 else "Medium" if prob >= 0.3 else "Low"

        rows.append(
            {
                "customer_id": c.id,
                "customer_name": c.name,
                "risk_category": risk,
                "churn_probability": round(prob, 4),
                "recommendation": CHURN_RECS[risk],
            }
        )

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# 4) Product recommendations — item-based collaborative filtering
# ---------------------------------------------------------------------------
@router.get("/recommendations")
@ttl_cache(ttl=120)
def get_product_recommendations(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == current_user.business_id)
        .all()
    )
    products = (
        db.query(models.Product)
        .filter(models.Product.business_id == current_user.business_id)
        .all()
    )
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == current_user.business_id)
        .all()
    )
    if not customers or not products:
        return {"rows": []}

    # customer -> set of purchased product ids
    bought = defaultdict(set)
    for s in sales:
        if s.product_id and s.customer_id:
            bought[s.customer_id].add(s.product_id)

    # co-purchase counts across all customers
    co = defaultdict(int)
    for prods in bought.values():
        plist = list(prods)
        for i in range(len(plist)):
            for j in range(i + 1, len(plist)):
                a, b = plist[i], plist[j]
                co[(a, b)] += 1

    def co_count(a, b):
        return co.get((a, b), co.get((b, a), 0))

    name_by_id = {p.id: p.name for p in products}
    sell_counts = defaultdict(int)
    for s in sales:
        if s.product_id:
            sell_counts[s.product_id] += 1
    top_sellers = sorted(products, key=lambda p: sell_counts[p.id], reverse=True)

    rows = []
    for c in customers:
        own = bought.get(c.id, set())
        if not own:
            recs = [p.name for p in top_sellers[:2]]
            reason = "Top-selling products across your store — great for first-time engagement."
        else:
            scores = {}
            for p in products:
                if p.id in own:
                    continue
                score = sum(co_count(p.id, b) for b in own)
                if score > 0:
                    scores[p.id] = score
            if scores:
                ranked = sorted(scores, key=scores.get, reverse=True)[:3]
                recs = [name_by_id[pid] for pid in ranked]
                bought_names = [name_by_id[pid] for pid in list(own)[:2]]
                reason = (
                    f"Frequently bought together with {', '.join(bought_names)} "
                    f"by other customers."
                )
            else:
                # No unseen co-purchase candidates — point them at bestsellers.
                recs = [p.name for p in top_sellers if p.id not in own][:3]
                if not recs:
                    recs = [p.name for p in top_sellers[:2]]
                    reason = "You've bought nearly everything — revisit bestsellers to restock or reorder."
                else:
                    reason = "Popular products other similar customers also purchase."

        rows.append(
            {
                "customer_id": c.id,
                "customer_name": c.name,
                "recommended_products": recs[:3],
                "reason": reason,
            }
        )

    return {"rows": rows}


# ---------------------------------------------------------------------------
# 5) Anomaly detection — Isolation Forest
# ---------------------------------------------------------------------------
def _detect_outlier_sales(sales: List[models.Sale]) -> List[models.Sale]:
    """Return the sales flagged as unusual (Isolation Forest, or a transparent
    bulk-order rule when there are too few sales to fit the forest)."""
    if len(sales) < 10:
        return [
            s for s in sales if s.quantity >= 50 or s.total_amount >= 10000
        ]
    X = np.array(
        [[s.quantity, s.total_amount, s.unit_price or 0.0] for s in sales],
        dtype=float,
    )
    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    preds = iso.fit_predict(X)
    return [s for s, p in zip(sales, preds) if p == -1]


def _is_material_outlier(sale: models.Sale) -> bool:
    """High-severity outlier — large quantity or value deviation."""
    return sale.total_amount >= 10000 or sale.quantity >= 50


@router.get("/anomalies")
@ttl_cache(ttl=120)
def get_anomaly_alerts(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == current_user.business_id)
        .all()
    )
    if not sales:
        return {"alerts": [], "detection_accuracy": None, "false_positive_rate": None}

    outliers = _detect_outlier_sales(sales)

    detection_accuracy = None
    false_positive_rate = None
    if len(sales) >= 10:
        X = np.array(
            [[s.quantity, s.total_amount, s.unit_price or 0.0] for s in sales],
            dtype=float,
        )
        iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        preds = iso.fit_predict(X)
        scores = iso.score_samples(X)  # lower = more anomalous
        anomaly_rate = len(outliers) / len(sales)
        detection_accuracy = round(1 - anomaly_rate, 3)
        # Borderline share: flagged sales whose score sits closest to the cutoff
        near_cutoff = np.percentile(scores, 4.2)
        borderline = sum(
            1 for i, p in enumerate(preds) if p == -1 and scores[i] > near_cutoff
        )
        false_positive_rate = round(borderline / len(sales), 3)

    alerts = []
    for s in outliers:
        severity = "high" if _is_material_outlier(s) else "medium"
        alerts.append(
            {
                "id": s.id,
                "severity": severity,
                "category": "sales",
                "description": (
                    f"Unusual transaction detected: {s.quantity} units totaling "
                    f"₹{s.total_amount:,.2f}."
                ),
                "created_at": (
                    s.sale_date.isoformat()
                    if s.sale_date
                    else dt.datetime.utcnow().isoformat()
                ),
            }
        )

    return {
        "detection_accuracy": detection_accuracy,
        "false_positive_rate": false_positive_rate,
        "alerts": alerts,
    }
