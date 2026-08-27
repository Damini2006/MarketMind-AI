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
from ..deps import get_current_user, require_roles

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
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
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

    # Persist the forecast rows (pre-dev parity) so results survive restarts
    # and can be queried without retraining. Runs once per cache window.
    try:
        db.query(models.Forecast).filter(
            models.Forecast.business_id == current_user.business_id
        ).delete()
        for f in forecast:
            db.add(
                models.Forecast(
                    business_id=current_user.business_id,
                    forecast_date=dt.date.fromisoformat(f["period"]),
                    predicted_revenue=f["predicted_revenue"],
                    model_used="LinearRegression",
                    confidence_score=r2,
                )
            )
        db.commit()
    except Exception:
        db.rollback()

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
                "cluster_number": int(labels[i]),
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

    # Persist segment assignments (pre-dev parity).
    try:
        cids = [c["customer_id"] for c in customer_list]
        if cids:
            db.query(models.CustomerSegment).filter(
                models.CustomerSegment.customer_id.in_(cids)
            ).delete()
            for c in customer_list:
                db.add(
                    models.CustomerSegment(
                        customer_id=c["customer_id"],
                        segment_name=c["segment"],
                        cluster_number=c["cluster_number"],
                        confidence=silhouette,
                    )
                )
            db.commit()
    except Exception:
        db.rollback()

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
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
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

    # Persist churn predictions (pre-dev parity).
    try:
        cids = [r["customer_id"] for r in rows]
        if cids:
            db.query(models.ChurnPrediction).filter(
                models.ChurnPrediction.customer_id.in_(cids)
            ).delete()
            for r in rows:
                db.add(
                    models.ChurnPrediction(
                        customer_id=r["customer_id"],
                        churn_probability=r["churn_probability"],
                        risk_level=r["risk_category"],
                        recommendation=r["recommendation"],
                    )
                )
            db.commit()
    except Exception:
        db.rollback()

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

    # Persist recommendations (pre-dev parity), mapping product names → ids.
    try:
        pid_by_name = {p.name: p.id for p in products}
        cids = [r["customer_id"] for r in rows]
        if cids:
            db.query(models.ProductRecommendation).filter(
                models.ProductRecommendation.customer_id.in_(cids)
            ).delete()
            for r in rows:
                for name in r["recommended_products"]:
                    pid = pid_by_name.get(name)
                    if pid is not None:
                        db.add(
                            models.ProductRecommendation(
                                customer_id=r["customer_id"],
                                product_id=pid,
                                recommendation_type="cross_sell",
                                score=1.0,
                            )
                        )
            db.commit()
    except Exception:
        db.rollback()

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
    min_confidence: float = 0.0,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    """Full 15-technique anomaly detection pipeline.

    Query params:
      min_confidence (float, 0-1): Auto-dismiss anomalies below this threshold.
    """
    from ..ml.anomaly_detection import run_full_detection
    result = run_full_detection(db)
    # Auto-dismiss: filter out anomalies below the confidence threshold
    if min_confidence > 0:
        result["alerts"] = [a for a in result["alerts"] if a["confidence"] >= min_confidence]
        result["auto_dismiss_threshold"] = min_confidence
        result["auto_dismissed_count"] = len(result["alerts"])
    else:
        result["auto_dismiss_threshold"] = 0
        result["auto_dismissed_count"] = 0
    return result


@router.post("/anomalies/rescan")
def rescan_anomalies(
    min_confidence: float = 0.0,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    """Force a fresh anomaly scan, bypassing the TTL cache.

    This re-runs all 15 detection techniques on the latest data.
    Query params:
      min_confidence (float, 0-1): Auto-dismiss anomalies below this threshold.
    """
    from ..ml.anomaly_detection import run_full_detection
    result = run_full_detection(db)
    if min_confidence > 0:
        result["alerts"] = [a for a in result["alerts"] if a["confidence"] >= min_confidence]
        result["auto_dismiss_threshold"] = min_confidence
        result["auto_dismissed_count"] = len(result["alerts"])
    else:
        result["auto_dismiss_threshold"] = 0
        result["auto_dismissed_count"] = 0
    return result


@router.get("/clv")
@ttl_cache(ttl=120)
def get_customer_lifetime_value(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    """Compute Customer Lifetime Value (CLV) for all customers.

    Uses historical purchase data to calculate:
    - Average Order Value (AOV)
    - Purchase Frequency (orders per month)
    - Customer Lifespan (months since first purchase)
    - CLV = AOV x Frequency x Lifespan
    - 6-month predicted CLV
    - CLV segment (high / medium / low / at_risk)
    """
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == current_user.business_id)
        .all()
    )
    all_sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == current_user.business_id)
        .all()
    )

    sales_by_customer = defaultdict(list)
    for s in all_sales:
        if s.customer_id:
            sales_by_customer[s.customer_id].append(s)

    now = dt.datetime.utcnow()
    customer_clvs = []

    for c in customers:
        c_sales = sales_by_customer.get(c.id, [])
        if not c_sales:
            customer_clvs.append({
                "customer_id": c.id, "customer_name": c.name, "email": c.email,
                "total_orders": 0, "total_revenue": 0, "avg_order_value": 0,
                "purchase_frequency": 0, "lifespan_months": 0, "clv": 0,
                "predicted_6m_clv": 0, "segment": "at_risk", "last_purchase_days": None,
            })
            continue

        amounts = [float(s.total_amount or 0) for s in c_sales]
        total_revenue = sum(amounts)
        total_orders = len(c_sales)
        aov = total_revenue / total_orders if total_orders > 0 else 0

        dates = [s.sale_date for s in c_sales if s.sale_date]
        if dates:
            first_purchase = min(dates)
            lifespan_days = max((now - first_purchase).days, 1)
            lifespan_months = lifespan_days / 30.0
        else:
            lifespan_months = 1

        frequency = total_orders / lifespan_months if lifespan_months > 0 else 0
        clv = aov * frequency * lifespan_months
        predicted_6m = aov * frequency * 6

        last_date = max(dates) if dates else None
        last_purchase_days = (now - last_date).days if last_date else None

        if predicted_6m >= 50000:
            segment = "high"
        elif predicted_6m >= 15000:
            segment = "medium"
        elif last_purchase_days and last_purchase_days > 60:
            segment = "at_risk"
        else:
            segment = "low"

        customer_clvs.append({
            "customer_id": c.id, "customer_name": c.name, "email": c.email,
            "total_orders": total_orders, "total_revenue": round(total_revenue, 2),
            "avg_order_value": round(aov, 2), "purchase_frequency": round(frequency, 2),
            "lifespan_months": round(lifespan_months, 1), "clv": round(clv, 2),
            "predicted_6m_clv": round(predicted_6m, 2), "segment": segment,
            "last_purchase_days": last_purchase_days,
        })

    customer_clvs.sort(key=lambda x: x["predicted_6m_clv"], reverse=True)

    total_clv = sum(c["clv"] for c in customer_clvs)
    avg_clv = total_clv / len(customer_clvs) if customer_clvs else 0
    segment_counts = defaultdict(int)
    for c in customer_clvs:
        segment_counts[c["segment"]] += 1

    return {
        "customers": customer_clvs,
        "summary": {
            "total_clv": round(total_clv, 2),
            "avg_clv": round(avg_clv, 2),
            "total_customers": len(customer_clvs),
            "high_value": segment_counts.get("high", 0),
            "medium_value": segment_counts.get("medium", 0),
            "low_value": segment_counts.get("low", 0),
            "at_risk": segment_counts.get("at_risk", 0),
        },
    }


# ── AI Chat Endpoint (RAG-style) ─────────────────────────────────────────
import re as _re

@router.get("/chat")
async def ai_chat(question: str = "", db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Smart NL answers from DB data — works like a simple RAG chatbot."""
    q = question.lower().strip()
    biz_id = getattr(current_user, "business_id", None)

    # Gather all data
    sales = db.query(models.Sale).filter(models.Sale.business_id == biz_id).all() if biz_id else db.query(models.Sale).all()
    products = db.query(models.Product).filter(models.Product.business_id == biz_id).all() if biz_id else db.query(models.Product).all()
    customers = db.query(models.Customer).filter(models.Customer.business_id == biz_id).all() if biz_id else db.query(models.Customer).all()
    invoices = db.query(models.Invoice).filter(models.Invoice.business_id == biz_id).all() if biz_id else db.query(models.Invoice).all()

    total_rev = sum(s.total_amount or 0 for s in sales)
    avg_order = total_rev / len(sales) if sales else 0
    low_stock = [p for p in products if (p.stock_quantity or 0) <= (p.reorder_threshold or 5)]
    paid = [i for i in invoices if i.status == "paid"]
    overdue = [i for i in invoices if i.status == "overdue"]
    pending = [i for i in invoices if i.status == "pending"]

    # Top products by revenue
    prod_rev = {}
    prod_qty = {}
    for s in sales:
        pid = s.product_id
        prod_rev[pid] = prod_rev.get(pid, 0) + (s.total_amount or 0)
        prod_qty[pid] = prod_qty.get(pid, 0) + (s.quantity or 1)
    top_prods = sorted(prod_rev.items(), key=lambda x: x[1], reverse=True)[:5]
    top_by_qty = sorted(prod_qty.items(), key=lambda x: x[1], reverse=True)[:5]

    # Top customers
    cust_rev = {}
    for s in sales:
        cid = s.customer_id
        cust_rev[cid] = cust_rev.get(cid, 0) + (s.total_amount or 0)
    top_custs = sorted(cust_rev.items(), key=lambda x: x[1], reverse=True)[:5]

    INR = lambda n: f"₹{n:,.0f}"
    pname = lambda pid: next((p.name for p in products if p.id == pid), f"#{pid}")
    cname = lambda cid: next((c.name for c in customers if c.id == cid), f"#{cid}")

    answer = ""
    card = None

    if not q or q in ("hi", "hello", "hey"):
        answer = f"Hi! Your business has {len(sales)} sales worth {INR(total_rev)}, {len(customers)} customers, {len(products)} products, and {len(invoices)} invoices. What would you like to know?"
    elif any(w in q for w in ["revenue", "total", "earning", "income", "money", "how much"]):
        trend_pct = 0
        answer = f"Your total revenue is {INR(total_rev)} from {len(sales)} sales. Average order value is {INR(avg_order)}."
        card = {"title": "Revenue Overview", "color": "#22c55e", "highlight": INR(total_rev),
                "stats": [{"label": "Total Sales", "value": str(len(sales)), "color": "#3b82f6"},
                          {"label": "Avg Order", "value": INR(avg_order), "color": "#f59e0b"},
                          {"label": "Products", "value": str(len(products)), "color": "#8b5cf6"}],
                "trend": trend_pct}
    elif any(w in q for w in ["customer", "client", "buyer", "who"]):
        top3 = [(cname(cid), r) for cid, r in top_custs[:3]]
        answer = f"You have {len(customers)} customers. Top spenders: {', '.join(f'{n} ({INR(r)})' for n, r in top3)}."
        card = {"title": "Customer Insights", "color": "#3b82f6", "highlight": f"{len(customers)} customers",
                "stats": [{"label": "Total Revenue", "value": INR(total_rev), "color": "#22c55e"},
                          {"label": "Avg Spend", "value": INR(total_rev / len(customers)) if customers else INR(0), "color": "#f59e0b"}]}
    elif any(w in q for w in ["product", "best", "sell", "top", "most sold"]):
        top3 = [(pname(pid), q, r) for pid, r in [(pid, prod_rev[pid]) for pid, _ in top_prods[:3]]]
        answer = f"Best sellers: {', '.join(f'{n} ({q} units, {INR(r)})' for n, q, r in top3)}."
        card = {"title": "Best Selling Products", "color": "#f59e0b", "highlight": top3[0][0] if top3 else "N/A",
                "stats": [{"label": "Units Sold", "value": str(top3[0][1]) if top3 else "0", "color": "#3b82f6"},
                          {"label": "Revenue", "value": INR(top3[0][2]) if top3 else INR(0), "color": "#22c55e"}]}
    elif any(w in q for w in ["stock", "inventory", "low", "out of"]):
        answer = f"{len(low_stock)} items are low on stock: {', '.join(p.name for p in low_stock[:5])}. Total products: {len(products)}."
        card = {"title": "Inventory Status", "color": "#f59e0b", "highlight": f"{len(low_stock)} low stock items",
                "stats": [{"label": "Total Products", "value": str(len(products)), "color": "#3b82f6"},
                          {"label": "Low Stock", "value": str(len(low_stock)), "color": "#ef4444"}]}
    elif any(w in q for w in ["invoice", "bill", "overdue", "paid", "pending"]):
        over_amt = sum(i.amount or 0 for i in overdue)
        answer = f"Invoices: {len(paid)} paid, {len(pending)} pending, {len(overdue)} overdue. Overdue amount: {INR(over_amt)}."
        card = {"title": "Invoice Status", "color": "#3b82f6", "highlight": f"{len(overdue)} overdue",
                "stats": [{"label": "Paid", "value": str(len(paid)), "color": "#22c55e"},
                          {"label": "Pending", "value": str(len(pending)), "color": "#f59e0b"},
                          {"label": "Overdue", "value": str(len(overdue)), "color": "#ef4444"}]}
    elif any(w in q for w in ["anomal", "suspicious", "unusual", "fraud"]):
        alerts = db.query(models.AnomalyAlert).filter(models.AnomalyAlert.business_id == biz_id).all() if biz_id else db.query(models.AnomalyAlert).all()
        high = [a for a in alerts if getattr(a, "severity", "") == "high"]
        answer = f"{len(alerts)} anomalies detected ({len(high)} high severity)."
        card = {"title": "Anomaly Detection", "color": "#ef4444", "highlight": f"{len(alerts)} anomalies",
                "stats": [{"label": "High", "value": str(len(high)), "color": "#ef4444"},
                          {"label": "Total", "value": str(len(alerts)), "color": "#f59e0b"}]}
    elif any(w in q for w in ["team", "employee", "staff", "user"]):
        users = db.query(models.User).all()
        answer = f"Team has {len(users)} members: {', '.join(u.full_name for u in users[:5])}."
        card = {"title": "Team Overview", "color": "#8b5cf6", "highlight": f"{len(users)} members",
                "stats": [{"label": "Active", "value": str(sum(1 for u in users if u.is_active)), "color": "#22c55e"}]}
    elif any(w in q for w in ["segment", "cluster", "group"]):
        answer = "Customer segmentation uses K-Means clustering on purchase frequency, recency, and monetary value."
    elif any(w in q for w in ["churn", "risk", "leave"]):
        answer = "Churn risk analysis uses logistic regression to predict which customers might stop buying."
    elif any(w in q for w in ["forecast", "predict", "trend"]):
        answer = "Revenue forecasting uses linear regression trained on daily sales data."
    elif any(w in q for w in ["help", "what can", "how"]):
        answer = "I can help with: revenue, customers, products, inventory, invoices, anomalies, team, segments, churn, and forecasts. Just ask!"
    else:
        answer = f"Your business has {len(sales)} sales worth {INR(total_rev)}, {len(customers)} customers, {len(products)} products, and {len(invoices)} invoices. Ask me about any of these!"

    return {"answer": answer, "card": card}

