"""AI intelligence endpoints — real scikit-learn models over the tenant's data.

- /forecast       : robust (Huber) regression on revenue trend (day index, weekday),
                    granularity=daily|weekly — weekly sums daily predictions into
                    Mon-Sun totals, where burstiness averages out and errors are
                    far lower than the bursty daily figures
- /segmentation   : K-Means clustering on RFM features, named by cluster centroids
- /churn          : current-risk classifier over RFM/cadence features (tuned threshold)
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
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .cache import get_or_set

from sklearn.linear_model import HuberRegressor, LogisticRegression
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    silhouette_score,
)
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import StratifiedKFold, cross_validate

from . import models
from .database import get_db
from .deps import get_current_user, require_roles

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


# An unbroken run of zero-revenue days this long means "no records for these
# days", not "the shop sold nothing for a fortnight". Zero-filling such a hole
# makes recent averages collapse toward zero, which used to drag the trend
# verdict to "decreasing" and inflate forecast error with phantom ₹0 actuals.
GAP_MIN_DAYS = 4
# Rolling-origin backtest: train on everything before each origin, score the
# next BACKTEST_HORIZON days, slide forward by BACKTEST_STEP and pool the folds.
BACKTEST_MIN_TRAIN = 35
BACKTEST_HORIZON = 7
BACKTEST_STEP = 7
SEASONAL_NAIVE_LAG = 7  # same weekday one week earlier
GROWTH_NOISE_FLOOR = 3.0  # |growth| below this is noise, not a trend


def _long_zero_run_mask(y: np.ndarray, min_days: int = GAP_MIN_DAYS) -> np.ndarray:
    """True for every day inside a run of >= `min_days` consecutive zero days."""
    n = len(y)
    mask = np.zeros(n, dtype=bool)
    run = 0
    for i, v in enumerate(y):
        if v == 0:
            run += 1
            continue
        if run >= min_days:
            mask[i - run : i] = True
        run = 0
    if run >= min_days:
        mask[n - run :] = True
    return mask


def _backtest_forecast(X: np.ndarray, y: np.ndarray):
    """Rolling-origin backtest over the observed (non-gap) days.

    A single 80/20 split reports whatever the one held-out window happened to
    contain. With bursty retail revenue that is very unstable -- a window
    holding a single large order can even score R^2 below zero -- so this pools
    many short folds, and also scores two naive baselines the model should beat
    to be worth using at all.

    Returns (mae, rmse, seasonal_naive_mae, mean_baseline_mae, n_eval_days).
    """
    n = len(y)
    actual, predicted, seasonal, meanonly = [], [], [], []
    end = n - BACKTEST_HORIZON + 1
    for origin in range(BACKTEST_MIN_TRAIN, end, BACKTEST_STEP):
        model = HuberRegressor(max_iter=500).fit(X[:origin], y[:origin])
        actual.extend(y[origin : origin + BACKTEST_HORIZON])
        predicted.extend(model.predict(X[origin : origin + BACKTEST_HORIZON]))
        seasonal.extend(
            y[origin - SEASONAL_NAIVE_LAG : origin - SEASONAL_NAIVE_LAG + BACKTEST_HORIZON]
        )
        meanonly.extend([float(y[:origin].mean())] * BACKTEST_HORIZON)
    if not actual:
        return None, None, None, None, 0
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    return (
        float(mean_absolute_error(a, p)),
        float(math.sqrt(mean_squared_error(a, p))),
        float(mean_absolute_error(a, np.asarray(seasonal, dtype=float))),
        float(mean_absolute_error(a, np.asarray(meanonly, dtype=float))),
        len(a),
    )


def _persist_forecast_rows(
    db: Session, business_id: int, forecast_rows: List[dict], model_used: str, confidence_score
) -> None:
    """Replace the tenant's stored Forecast rows (pre-dev parity table; written
    but not read anywhere) so results survive restarts. Failures are swallowed:
    persistence must never break the served forecast."""
    try:
        db.query(models.Forecast).filter(
            models.Forecast.business_id == business_id
        ).delete()
        for f in forecast_rows:
            db.add(
                models.Forecast(
                    business_id=business_id,
                    forecast_date=dt.date.fromisoformat(f["period"]),
                    predicted_revenue=f["predicted_revenue"],
                    model_used=model_used,
                    confidence_score=confidence_score,
                )
            )
        db.commit()
    except Exception:
        db.rollback()


def _local_now() -> dt.datetime:
    """Naive server-LOCAL 'now' for comparing against stored sale timestamps.

    Sales are timestamped with naive local times (server runs in Asia/Kolkata
    for this app); anchoring 'today' to raw UTC made the calendar lag behind
    the newest sale after 5:00 PM IST, silently inflating recency values and
    skewing the forecast window. The result stays naive so it compares
    correctly with the stored timestamps.
    """
    now = dt.datetime.now()
    if now.tzinfo is not None:
        now = now.replace(tzinfo=None)
    return now


# ---------------------------------------------------------------------------
# 1) Sales forecasting — robust (Huber) regression on daily revenue
# ---------------------------------------------------------------------------
@router.get("/forecast")
@router.get("/forecasting")
@ttl_cache(ttl=600)
def get_sales_forecast(
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
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
            "mae_pct_of_avg": None,
            "baseline_mae": None,
            "baseline_name": None,
            "baseline_skill_pct": None,
            "eval_days": None,
            "data_through": None,
            "granularity": granularity,
        }

    dates, y = _daily_revenue_series(sales)

    # Zero-fill missing calendar days between first and last sale. Without
    # this, absent days silently collapse the time axis: a closed Sunday and
    # the previous Saturday become adjacent points, which distorts both the
    # day-index feature and the weekday seasonality the model learns.
    dense_dates, dense_y = [], []
    for d, v in zip(dates, y):
        if not dense_dates:
            dense_dates.append(d)
            dense_y.append(v)
            continue
        gap = (d - dense_dates[-1]).days
        if gap > 1:
            for k in range(1, gap):
                dense_dates.append(dense_dates[-1] + dt.timedelta(days=1))
                dense_y.append(0.0)
        dense_dates.append(d)
        dense_y.append(v)

    # Trim the partial current day: "today" only holds the hours elapsed so
    # far, so its total is a fraction of a normal day. Left in, it deflates
    # the end of the series and drags the fitted trend negative -- a top
    # reason healthy businesses were told they were "decreasing". Only
    # trimmed when a full day has already elapsed after it in local time.
    now_local = _local_now()
    today_local = now_local.date()
    if dense_dates and dense_dates[-1] >= today_local and len(dense_dates) > 1:
        dense_dates = dense_dates[:-1]
        dense_y = dense_y[:-1]
    dates, y = dense_dates, np.array(dense_y, dtype=float)

    n = len(y)
    if n == 0:
        return {
            "trend": "insufficient_data",
            "history": [],
            "forecast": [],
            "growth_pct": None,
            "mae": None,
            "rmse": None,
            "mae_pct_of_avg": None,
            "baseline_mae": None,
            "baseline_name": None,
            "baseline_skill_pct": None,
            "eval_days": None,
            "data_through": None,
            "granularity": granularity,
        }

    history = [
        {"date": d.isoformat(), "revenue": round(float(v), 2)}
        for d, v in zip(dates, y)
    ]

    # ── Missing-data gaps ──
    # A long unbroken run of zero days is a hole in the records, not a run of
    # zero-sales days. Left in, it drags every recent average toward zero and
    # corrupts the error metrics with phantom ₹0 actuals -- it is what made a
    # healthy business report a "decreasing" trend. Those days are excluded
    # from fitting, from the trend and from the backtest; they remain in
    # `history` so the chart still shows the true calendar.
    dows = np.array([d.weekday() for d in dates], dtype=int)
    gap_mask = _long_zero_run_mask(y)
    observed = ~gap_mask
    obs_idx = np.flatnonzero(observed).astype(float)
    obs_y = y[observed]
    obs_x = np.column_stack(
        [obs_idx] + [(dows[observed] == k).astype(float) for k in range(7)]
    )

    # Features: day index (captures trend) + one-hot day-of-week (captures
    # weekly seasonality). Month was removed deliberately: with 1-2 months of
    # history it is almost collinear with the day index, so the two features
    # split the level shift between them and the fitted day-slope flips sign --
    # the reported trend went "decreasing" for data that was clearly growing.
    day_idx = np.arange(n, dtype=float)
    X = np.column_stack([day_idx] + [(dows == k).astype(float) for k in range(7)])

    # ── Backtest metrics (rolling-origin, over observed days only) ──
    mae = rmse = mae_pct_of_avg = None
    baseline_mae = mean_baseline_mae = baseline_skill_pct = eval_days = None
    if len(obs_y) >= BACKTEST_MIN_TRAIN + BACKTEST_HORIZON:
        mae, rmse, baseline_mae, mean_baseline_mae, eval_days = _backtest_forecast(
            obs_x, obs_y
        )
    if mae is not None:
        avg_daily = float(obs_y.mean())
        mae = round(mae, 2)
        rmse = round(rmse, 2)
        baseline_mae = round(baseline_mae, 2)
        mean_baseline_mae = round(mean_baseline_mae, 2)
        # MAE alone is hard to judge; express it against the business's own
        # average day so the number is interpretable without a baseline.
        mae_pct_of_avg = round(mae / avg_daily * 100, 1) if avg_daily > 0 else None
        # Skill over the seasonal-naive forecast (same weekday, last week).
        baseline_skill_pct = (
            round((1 - mae / baseline_mae) * 100, 1) if baseline_mae else None
        )

    # ── Served model: robust fit on all observed history ──
    # Huber loss rather than plain least squares: daily revenue contains large
    # one-off orders, and squared error lets a single ₹70k day dominate the
    # fit. In the rolling backtest the robust fit beats both least squares and
    # the mean-only baseline.
    if len(obs_y) >= 10:
        model = HuberRegressor(max_iter=500).fit(obs_x, obs_y)
        predict = model.predict
    else:
        # Too little history — naive flat forecast, no fabricated metrics.
        mean_rev = float(obs_y.mean()) if len(obs_y) else 0.0
        predict = lambda fX: np.full(len(fX), mean_rev)  # noqa: E731

    # ── Weekly view (granularity=weekly) ──
    # Daily revenue for a small business is dominated by a few large one-off
    # orders (here 6 spike days carry ~27% of all revenue), which no trend
    # model can track day to day. Aggregating to Mon-Sun weeks averages that
    # burstiness out: the weekly backtest scores ~40% of an average week
    # against ~67% for daily. The missing-data rule applies one level up too:
    # weeks containing a zero-run gap are holes in the records, not ₹0 weeks,
    # so they are excluded from fitting and evaluation rather than zero-filled.
    if granularity == "weekly":
        today = dt.date.today()
        cur_wk_start = today - dt.timedelta(days=today.weekday())
        wk_rev, wk_days = defaultdict(float), defaultdict(int)
        for d, v, is_gap in zip(dates, y, gap_mask):
            if is_gap:
                continue
            w = d - dt.timedelta(days=d.weekday())  # the week's Monday
            if w >= cur_wk_start:
                # The partial current week cannot hold a full week's revenue.
                continue
            wk_rev[w] += float(v)
            wk_days[w] += 1
        # A week is complete only when every one of its 7 days sits inside the
        # calendar AND is observed (not gap): weeks clipped by the start of the
        # data or overlapping a missing-data gap would otherwise read as low-
        # revenue weeks and drag the fit down.
        weeks = sorted(
            w
            for w in wk_rev
            if wk_days[w] == 7
            and w >= dates[0]
            and w + dt.timedelta(days=6) <= dates[-1]
        )

        if len(weeks) < 6:
            return {
                "trend": "insufficient_data",
                "growth_pct": None,
                "mae": None,
                "rmse": None,
                "mae_pct_of_avg": None,
                "baseline_mae": None,
                "baseline_name": None,
                "baseline_skill_pct": None,
                "eval_days": None,
                "data_through": dates[-1].isoformat() if dates else None,
                "granularity": "weekly",
                "history": [],
                "forecast": [],
                "history_note": None,
            }

        wy = np.array([wk_rev[w] for w in weeks], dtype=float)
        N = len(wy)
        wx = np.arange(N, dtype=float).reshape(-1, 1)
        wk_level = float(wy.mean())

        # Rolling-origin backtest on weeks: retrain on history up to each
        # week, score the next 2, pool all folds. Naive baseline = the same
        # two weeks one month back (the weekly analogue of seasonal-naive).
        w_horizon = 2
        w_mae = w_rmse = w_naive_mae = w_eval_weeks = None
        if N >= 6 + w_horizon:
            actual, predicted, naive = [], [], []
            for o in range(6, N - w_horizon + 1):
                m = HuberRegressor(max_iter=500).fit(wx[:o], wy[:o])
                actual.extend(wy[o : o + w_horizon])
                predicted.extend(m.predict(wx[o : o + w_horizon]))
                naive.extend(wy[o - 4 : o - 4 + w_horizon])
            if actual:
                aa = np.asarray(actual, dtype=float)
                pp = np.asarray(predicted, dtype=float)
                w_mae = float(mean_absolute_error(aa, pp))
                w_rmse = float(math.sqrt(mean_squared_error(aa, pp)))
                w_naive_mae = float(
                    mean_absolute_error(aa, np.asarray(naive, dtype=float))
                )
                w_eval_weeks = len(actual)
        if w_mae is not None:
            w_mae = round(w_mae, 2)
            w_rmse = round(w_rmse, 2)
            w_naive_mae = round(w_naive_mae, 2)
        w_pct = (
            round(w_mae / wk_level * 100, 1)
            if (w_mae is not None and wk_level > 0)
            else None
        )
        w_skill = (
            round((1 - w_mae / w_naive_mae) * 100, 1)
            if (w_mae is not None and w_naive_mae)
            else None
        )

        # Served weekly model: robust Huber fit on all complete weeks.
        wk_model = HuberRegressor(max_iter=500).fit(wx, wy)
        horizon_weeks = max(1, round(horizon_days / 7))
        wf_idx = np.arange(N, N + horizon_weeks, dtype=float).reshape(-1, 1)
        w_preds = np.maximum(wk_model.predict(wf_idx), 0)

        # Trend: Theil-Sen with the same CI-straddles-zero rule as daily.
        w_growth = 0.0
        w_trend = "stable"
        if N >= 8:
            try:
                from scipy.stats import theilslopes

                slope_w, _ic, wlo, whi = theilslopes(wy, np.arange(N, dtype=float))
            except Exception:  # scipy unavailable — least-squares fallback
                slope_w = float(np.polyfit(np.arange(N, dtype=float), wy, 1)[0])
                wlo = whi = None
            w_growth = (
                round(slope_w * 4.33 / wk_level * 100, 1) if wk_level > 0 else 0.0
            )
            if wlo is not None and wlo <= 0 <= whi:
                w_trend = "stable"
            elif w_growth > GROWTH_NOISE_FLOOR:
                w_trend = "increasing"
            elif w_growth < -GROWTH_NOISE_FLOOR:
                w_trend = "decreasing"

        w_history = [
            {"date": w.isoformat(), "revenue": round(float(v), 2)}
            for w, v in zip(weeks, wy)
        ]
        w_forecast = [
            {
                "period": (weeks[-1] + dt.timedelta(days=7 * (i + 1))).isoformat(),
                "predicted_revenue": round(float(p), 2),
            }
            for i, p in enumerate(w_preds)
        ]

        w_confidence = (
            round(max(0.0, min(w_skill / 100.0, 1.0)), 4)
            if w_skill is not None
            else None
        )
        _persist_forecast_rows(
            db, current_user.business_id, w_forecast, "HuberRegressor-weekly", w_confidence
        )

        return {
            "trend": w_trend,
            "growth_pct": w_growth,
            "mae": w_mae,
            "rmse": w_rmse,
            "mae_pct_of_avg": w_pct,
            "baseline_mae": w_naive_mae,
            "baseline_name": (
                "4-weeks-back (the same two weeks, one month earlier)"
                if w_naive_mae is not None
                else None
            ),
            "baseline_skill_pct": w_skill,
            # eval_days carries evaluation WEEKS in the weekly view.
            "eval_days": w_eval_weeks,
            "granularity": "weekly",
            "history": w_history,
            "forecast": w_forecast,
            "data_through": dates[-1].isoformat(),
            "history_note": (
                f"Weekly totals over {len(weeks)} complete Mon-Sun weeks; weeks "
                "overlapping a missing-data gap are excluded, and the partial "
                "current week is not counted."
            ),
        }

    # ── Trend & growth: Theil–Sen on a 7-day rolling mean ──
    # A raw day-slope over daily revenue flips sign on noise, and 7-vs-7 window
    # means are a coin flip on spiky daily data (a single ₹45k order day read as
    # "decreasing" for a business whose 30-day revenue was up 63%). The 7-day
    # rolling mean removes the weekly cycle and dampens spikes; the Theil–Sen
    # median-of-pairwise-slopes then estimates the direction robustly — it can
    # be broken only by corrupting >29% of the points.
    #
    # NOTE: scipy's theilslopes returns FOUR values (slope, intercept, low,
    # high). The previous code unpacked three, which raised on every call and
    # silently fell through to the least-squares fallback below, so the robust
    # estimator advertised here never actually ran.
    growth_pct = 0.0
    slope_ci = None
    if len(obs_y) >= 14:
        roll = np.convolve(obs_y, np.ones(7) / 7.0, mode="valid")
        try:
            from scipy.stats import theilslopes

            slope_per_day, _intercept, ci_low, ci_high = theilslopes(
                roll, np.arange(len(roll))
            )
            slope_ci = (float(ci_low), float(ci_high))
        except Exception:  # scipy unavailable — fallback to least squares
            slope_per_day = float(np.polyfit(np.arange(len(roll)), roll, 1)[0])
        level = float(np.median(obs_y))
        growth_pct = round(slope_per_day * 30.0 / level * 100, 1) if level > 0 else 0.0

    # The verdict comes from the 95% confidence interval of the slope rather
    # than its raw sign: when the interval straddles zero the direction is not
    # distinguishable from flat, and labelling that "increasing"/"decreasing"
    # is noise presented as insight.
    if slope_ci is not None and slope_ci[0] <= 0 <= slope_ci[1]:
        trend = "stable"
    elif growth_pct > GROWTH_NOISE_FLOOR:
        trend = "increasing"
    elif growth_pct < -GROWTH_NOISE_FLOOR:
        trend = "decreasing"
    else:
        trend = "stable"

    forecast = []
    if horizon_days > 0:
        last_date = dates[-1]
        future_days = [
            last_date + dt.timedelta(days=i) for i in range(1, horizon_days + 1)
        ]
        f_idx = np.arange(n, n + horizon_days, dtype=float)
        f_dow = np.array([d.weekday() for d in future_days], dtype=int)
        fX = np.column_stack([f_idx] + [(f_dow == k).astype(float) for k in range(7)])
        preds = np.maximum(predict(fX), 0)
        forecast = [
            {"period": d.isoformat(), "predicted_revenue": round(float(v), 2)}
            for d, v in zip(future_days, preds)
        ]

    # A single R^2-style "confidence" is not meaningful for bursty daily
    # revenue (on this data it is negative for every honest model), so the
    # legacy column carries the backtested skill over the naive baseline
    # instead, clamped to 0..1. Null when there was too little history.
    confidence_score = None
    if baseline_skill_pct is not None:
        confidence_score = round(max(0.0, min(baseline_skill_pct / 100.0, 1.0)), 4)

    # Persist the forecast rows (pre-dev parity) so results survive restarts
    # and can be queried without retraining. Runs once per cache window.
    _persist_forecast_rows(
        db, current_user.business_id, forecast, "HuberRegressor", confidence_score
    )

    return {
        "trend": trend,
        "growth_pct": growth_pct,
        "mae": mae,
        "rmse": rmse,
        # MAE expressed against the business's own average day, plus the skill
        # over a naive forecast, so forecast quality is judgeable without
        # relying on R^2 (which is not meaningful for spike-dominated daily
        # revenue and is routinely negative).
        "mae_pct_of_avg": mae_pct_of_avg,
        "baseline_mae": baseline_mae,
        "baseline_name": "seasonal-naive (same weekday, last week)" if baseline_mae is not None else None,
        "baseline_skill_pct": baseline_skill_pct,
        "eval_days": eval_days,
        "history": history,
        "forecast": forecast,
        # Last date the underlying data actually covers, so the UI can note
        # when the forecast horizon starts from a past data date (imported
        # datasets often end before "today").
        "data_through": dates[-1].isoformat(),
        "granularity": "daily",
        "history_note": None,
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
@ttl_cache(ttl=600)
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
# 3) Churn prediction — enhanced with visit-collapsing and personalized recs
# ---------------------------------------------------------------------------
# Uses the dedicated churn module (ml/churn.py) which:
#   - Collapses same-day multi-item purchases into single "visits"
#   - Uses adaptive per-customer churn labels (overdue vs their own cadence)
#   - Trains a Logistic Regression with StratifiedKFold cross-validation
#   - Generates personalized recommendations from each customer's own signals

@router.get("/churn")
@ttl_cache(ttl=600)
def get_churn_predictions(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    from ..ml.churn import run_churn_prediction
    return run_churn_prediction(db, business_id=current_user.business_id)


@router.get("/churn/features")
def get_churn_feature_contributions(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    """Per-customer churn feature contributions.

    Explains *why* each customer is flagged: for every risk signal (recency,
    frequency, spend, regularity, overdue ratio) the endpoint returns that
    customer's percentile within its own business cohort, so the owner sees
    whether a customer's risk is driven by inactivity, dropping spend, or
    erratic purchasing rather than by a global threshold.
    """
    from ..ml.churn import run_churn_prediction
    return run_churn_prediction(db, business_id=current_user.business_id)


# ---------------------------------------------------------------------------
# 4) Product recommendations — intelligent collaborative filtering
# ---------------------------------------------------------------------------
from pydantic import BaseModel
from ..ml import recommendations as ml_recs

@router.post("/recommendations/train")
def train_recommendations(
    db: Session = Depends(get_db), current_user=Depends(require_roles("business_owner", "admin"))
) -> Dict[str, Any]:
    """Train the collaborative filtering model for the business."""
    return ml_recs.train_recommendation_model(db, current_user.business_id)

@router.get("/recommendations")
@ttl_cache(ttl=600)
def get_all_recommendations(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    """Recommendations for every customer, one page at a time.

    Every number the dashboard shows is produced by the engine (live
    channels, model-derived confidence) or honestly measured
    (leave-last-basket-out backtest) -- nothing is simulated.

    The engine's business-wide aggregations run ONCE per request and are then
    sliced per customer (see ``build_recommendation_context``). Previously
    each backtest fold re-ran all of them, so a page load cost roughly twelve
    full passes over the sales tables and the 30s client timeout fired before
    the response was ready.

    `page`/`page_size` are honoured because the dashboard has always sent them
    and paginated on the reply; `rows` is this page, `type_counts` and
    `total_customers` describe the whole book so the filter chips and header
    are not page-local guesses.
    """
    from sqlalchemy import func as sa_func
    from ..ml.recommendations import build_recommendation_context
    cust_spending = (
        db.query(
            models.Sale.customer_id,
            sa_func.coalesce(sa_func.sum(models.Sale.total_amount), 0).label("total")
        )
        .filter(models.Sale.business_id == current_user.business_id)
        .group_by(models.Sale.customer_id)
        .subquery()
    )
    customers = (
        db.query(models.Customer)
        .outerjoin(cust_spending, models.Customer.id == cust_spending.c.customer_id)
        .filter(models.Customer.business_id == current_user.business_id)
        .order_by(sa_func.coalesce(cust_spending.c.total, 0).desc(), models.Customer.id)
        .all()
    )

    if not customers:
        empty_stats = {
            "customers_sampled": 0, "customers_total": 0,
            "recommendations_generated": 0, "avg_confidence": 0,
            "coverage_pct": 0, "revenue_covered_pct": 0,
            "channel_counts": {},
        }
        return {
            "rows": [],
            "page": 1,
            "page_size": page_size,
            "total_pages": 1,
            "total_customers": 0,
            "type_counts": {"all": 0},
            "stats": empty_stats,
            "backtest": {"hit_rate_at_3": None, "hit_rate_at_5": None, "trials": 0},
        }

    cust_ids = [c.id for c in customers]
    spend_by_cust = dict(
        db.query(models.Sale.customer_id, sa_func.coalesce(sa_func.sum(models.Sale.total_amount), 0))
        .filter(
            models.Sale.business_id == current_user.business_id,
            models.Sale.customer_id.in_(cust_ids),
        )
        .group_by(models.Sale.customer_id)
        .all()
    )
    order_count_by_cust = dict(
        db.query(models.Sale.customer_id, sa_func.count(models.Sale.id))
        .filter(
            models.Sale.business_id == current_user.business_id,
            models.Sale.customer_id.in_(cust_ids),
        )
        .group_by(models.Sale.customer_id)
        .all()
    )
    last_visit = dict(
        db.query(models.Sale.customer_id, sa_func.max(models.Sale.sale_date))
        .filter(
            models.Sale.business_id == current_user.business_id,
            models.Sale.customer_id.in_(cust_ids),
        )
        .group_by(models.Sale.customer_id)
        .all()
    )
    total_rev = float(sum(float(v) for v in spend_by_cust.values()))
    n_total = len(customers)

    # Average order value per customer: feeds the price-fit signal and the
    # upsell/cross-sell labelling on each card.
    aov_by_cust = {
        cid: (float(spend_by_cust.get(cid, 0)) / int(order_count_by_cust[cid]))
        for cid in cust_ids
        if int(order_count_by_cust.get(cid, 0)) > 0
    }

    # ONE round of business-wide aggregation, shared by the page and every
    # backtest fold below. It is plain data (dicts/sets/datetimes) and is
    # cached under the "ai:" prefix, so turning a page reuses it instead of
    # rebuilding it, and any sale/import invalidates it like the rest of the
    # AI responses.
    # TTL matches this endpoint's response cache below, so the context can never
    # outlive (and thus contradict) the response built from it. Startup's warm-up
    # thread builds it for every tenant, so a first page load normally pays only
    # the per-page work, not the aggregation.
    rec_ctx = get_or_set(
        f"ai:{current_user.business_id}:recs_context",
        600,
        lambda: build_recommendation_context(db, current_user.business_id),
    )

    # Batch-optimised: a handful of queries total instead of ~5 per customer
    # (N+1), plus a single shared context for the folds.
    signals: Dict[int, dict] = {}
    batch = ml_recs.get_all_recommendations_batch(
        db, current_user.business_id, cust_ids, limit=3,
        collect_signals=signals, context=rec_ctx, avg_order_values=aov_by_cust,
    )
    recs_by_cid = dict(batch)

    # -- Honest engine accuracy: holdout backtest --
    # Hold out 3 products each sampled customer actually bought, then ask the
    # engine to rank the catalogue for that customer and check whether the
    # held-out ids surface in the top-3 / top-5. The engine's reorder channel
    # legitimately scores repeat items, so held-out products CAN rank high --
    # exactly the signal being tested (does the model anticipate real
    # repurchases?). A real top-K hit rate on this business's own data,
    # replacing the fabricated '96.8% XGBoost' figure the old hero asserted.
    hits3 = hits5 = trials = 0
    # Bounded to the ten biggest customers, as before, and served from the
    # context already in hand -- the per-customer purchase history comes from
    # rec_ctx instead of a fresh 3-query lookup per fold.
    for c in customers[:10]:
        hist = rec_ctx.purchases.get(c.id, {})
        if len(hist) < 4:
            continue
        hist_list = sorted(hist.items())  # stable, deterministic holdout pick
        held = {pid for pid, _ in hist_list[-3:]}
        if len(held) >= len(hist):
            continue
        try:
            sig: dict = {}
            recs5 = ml_recs.get_all_recommendations_batch(
                db, current_user.business_id, [c.id], limit=8,
                collect_signals=sig, context=rec_ctx, avg_order_values=aov_by_cust,
            )
            recs5 = recs5[0][1] if recs5 else []
        except Exception:
            continue
        ranked = [r["product_id"] for r in recs5]
        top5 = ranked[:5]
        top3 = ranked[:3]
        trials += 1
        if any(pid in held for pid in top3):
            hits3 += 1
        if any(pid in held for pid in top5):
            hits5 += 1
    backtest = {
        "hit_rate_at_3": round(hits3 / trials, 3) if trials else None,
        "hit_rate_at_5": round(hits5 / trials, 3) if trials else None,
        "trials": trials,
    }

    by_id = {c.id: c for c in customers}
    all_rows = []
    for cid, recs in batch:
        c = by_id.get(cid)
        if not c or not recs:
            continue
        sig = signals.get(cid, {})
        # Each item carries BOTH the engine's raw blended score (raw_score) and
        # a 0-1 match score normalised against this customer's best pick, which
        # is what the card's match ring and the 70%/85% tiers read.
        items = [
            {
                "product_id": r["product_id"],
                "product_name": r.get("product_name", r["name"]),
                "name": r["name"],
                "price": float(r.get("price") or 0),
                "category": r.get("category"),
                "inventory_available": r.get("inventory_available"),
                "score": float(r.get("score", 0)),
                "raw_score": r.get("raw_score", 0),
                "match_pct": r.get("match_pct", 0),
                "recommendation_type": r.get("recommendation_type", "personalized"),
                "dominant_channel": r.get("dominant_channel"),
                "signals": r.get("signals", {}),
                "reason": r.get("reason", ""),
            }
            for r in recs
        ]
        all_rows.append({
            "customer_id": cid,
            "customer_name": c.name,
            "recommended_products": [r["name"] for r in recs],
            "reason": recs[0].get("reason", "Based on purchase history and similar customers."),
            # Model-derived match: each item's blended score normalised against
            # the customer's best item, so the strongest read reads 100%.
            # REAL relative model evidence, deterministic per data state.
            "match_pct": max((i["match_pct"] for i in items), default=0),
            "items": items,
            # The dashboard renders from `recommendations`; `items` is kept as
            # the original key for any older client.
            "recommendations": items,
            "confidence": sig.get("confidence", 0.25),
            "channels": sig.get("channels", ["popularity"]),
            "basis": sig.get("basis", 0.0),
            "total_spent": round(float(spend_by_cust.get(cid, 0)), 2),
            "order_count": int(order_count_by_cust.get(cid, 0)),
            "total_orders": int(order_count_by_cust.get(cid, 0)),
            "average_order_value": round(float(aov_by_cust.get(cid, 0.0)), 2),
            "last_purchase": last_visit.get(cid).isoformat() if last_visit.get(cid) else None,
        })

    # Aggregate counts describe the whole book, not just the requested page, so
    # the header and filter chips don't silently shrink when you turn a page.
    type_counts: Dict[str, int] = {"all": 0}
    for r in all_rows:
        for item in r["items"]:
            t = item.get("recommendation_type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1
            type_counts["all"] += 1

    channel_counts = {ch: 0 for ch in ("copurchase", "alsobought", "category", "reorder", "popularity")}
    for r in all_rows:
        for ch in r["channels"]:
            channel_counts[ch] = channel_counts.get(ch, 0) + 1

    total_pages = max(1, math.ceil(len(all_rows) / page_size))
    page = min(page, total_pages)  # never serve an empty page off the end
    start = (page - 1) * page_size
    rows = all_rows[start : start + page_size]

    return {
        "rows": rows,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "total_customers": len(all_rows),
        "type_counts": type_counts,
        "stats": {
            "customers_sampled": len(all_rows),
            "customers_total": int(n_total),
            "recommendations_generated": type_counts["all"],
            "avg_confidence": round(sum(r["confidence"] for r in all_rows) / len(all_rows), 2) if all_rows else 0,
            "coverage_pct": round(100.0 * len(all_rows) / n_total, 1) if n_total else 0,
            "revenue_covered_pct": 100.0 if total_rev > 0 else 0.0,
            "channel_counts": channel_counts,
        },
        "backtest": backtest,
    }

@router.get("/recommendations/customer/{customer_id}")
def get_personalized_recs(
    customer_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    """Get personalized product recommendations for a specific customer."""
    recs = ml_recs.get_personalized_recommendations(db, current_user.business_id, customer_id)
    return {"recommendations": recs}

class CrossSellRequest(BaseModel):
    product_ids: List[int]

@router.post("/recommendations/cross-sell")
def get_cross_sell_recs(
    req: CrossSellRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> Dict[str, Any]:
    """Get products frequently bought with the provided items."""
    recs = ml_recs.get_cross_sell_recommendations(db, current_user.business_id, req.product_ids)
    return {"recommendations": recs}


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
@ttl_cache(ttl=600)
def get_anomaly_alerts(
    min_confidence: float = 0.0,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "store_manager", "admin")),
) -> Dict[str, Any]:
    """Full anomaly detection pipeline including statistical/ML detection
    AND business-rule alerts (large quantity sales, stock depletion).

    Query params:
      min_confidence (float, 0-1): Auto-dismiss anomalies below this threshold.
    """
    from ..ml.anomaly_detection import run_full_detection
    from ..ml.business_rule_anomalies import get_business_rule_alerts

    result = run_full_detection(db, current_user.business_id)

    # Merge business-rule alerts into the same alert list
    biz_alerts = get_business_rule_alerts(db, current_user.business_id)
    result["alerts"].extend(biz_alerts)

    # Update summary counts to include business-rule alerts
    for a in biz_alerts:
        sev = a.get("severity", "medium")
        cat = a.get("category", "sales")
        result["summary"]["total_anomalies"] += 1
        result["summary"][f"{sev}_severity"] = result["summary"].get(f"{sev}_severity", 0) + 1
        result["summary"]["category_breakdown"][cat] = result["summary"]["category_breakdown"].get(cat, 0) + 1
        result["summary"]["method_breakdown"][a.get("anomaly_type", "business_rule")] = \
            result["summary"]["method_breakdown"].get(a.get("anomaly_type", "business_rule"), 0) + 1

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
    result = run_full_detection(db, current_user.business_id)
    if min_confidence > 0:
        result["alerts"] = [a for a in result["alerts"] if a["confidence"] >= min_confidence]
        result["auto_dismiss_threshold"] = min_confidence
        result["auto_dismissed_count"] = len(result["alerts"])
    else:
        result["auto_dismiss_threshold"] = 0
        result["auto_dismissed_count"] = 0
    return result


@router.get("/clv")
@ttl_cache(ttl=600)
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
        answer = "Revenue forecasting uses robust (Huber) regression trained on daily sales data, with weekday seasonality."
    elif any(w in q for w in ["help", "what can", "how"]):
        answer = "I can help with: revenue, customers, products, inventory, invoices, anomalies, team, segments, churn, and forecasts. Just ask!"
    else:
        answer = f"Your business has {len(sales)} sales worth {INR(total_rev)}, {len(customers)} customers, {len(products)} products, and {len(invoices)} invoices. Ask me about any of these!"

    return {"answer": answer, "card": card}

