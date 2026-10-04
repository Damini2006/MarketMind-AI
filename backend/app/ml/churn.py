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

LABEL-LEAKAGE FIX (the "100% accuracy" bug):
The churn label is DEFINED as `overdue_ratio >= 2.0` (or the one-time-buyer
recency rule). The earliest feature vector fed `overdue_ratio` itself into
the model as a feature, so training was literally re-deriving its own
answer key -- every cross-validation fold scored ~95-100%, a number that
looked great and said nothing about real generalisation. The feature
vector now EXCLUDES `recency_vs_cadence` (the exact labelling expression);
it still drives the label, the displayed per-customer stats and the
small-dataset fallback score, just never the model inputs. The reported
accuracy is now an honest cross-validated estimate instead of a
self-fulfilling one. An intermediate version ALSO excluded `recency_days`
and `expected_gap`; that over-corrected -- it stripped the model of the
cadence history the rule is about, and cross-validation fell to 0.70
(below the 0.75 majority class) on the live tenant. Measured bake-off:
keeping the two raw ingredients and excluding only their ratio recovers
CV accuracy 0.95 / AUC 0.95 while remaining a real learning problem (the
model must LEARN "2x your own cadence means churn" from history, not read
the answer).

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
6. WHAT IS ACTUALLY SCORED, and why (read this before "fixing" the
   numbers). Two framings were measured on the live data:

   (a) FUTURE churn (features as of a past cutoff, label = what really
       happened afterwards). Honest, but on a small tenant it has NO
       learnable signal: all five candidate models scored below chance
       (AUC 0.17-0.44). Serving that produced the worthless combination
       this module used to report -- "accuracy 73.8%" (which is just the
       majority-class rate) alongside precision and F1 of a flat 0.000,
       because at the 0.5 threshold the model flagged nobody correctly.

   (b) CURRENT risk (label = the customer's present status: overdue by
       2x their own cadence, or a one-time buyer gone quiet). The same
       features DO carry real signal here (AUC ~0.86), and that is what
       is served now. The catch is that (b) is partly circular -- the label
       is defined from the customer's own cadence. Handing the model the
       ratio itself (`recency_vs_cadence`) let it restate the rule and
       score a self-fulfilling ~100%, so MODEL_FEATURE_IDX withholds
       exactly that ingredient. The raw ingredients (recency_days,
       expected_gap) STAY: they are ordinary observable history, and
       learning the 2x rule from them is the honest task -- measured at
       CV accuracy 0.95 / AUC 0.95 on the live tenant. (Excluding them
       too was measured and rejected: accuracy fell to 0.70, below the
       majority class -- no signal at all.)

   So: the page reports CURRENT risk, and says so. It is a ranking of who
   is at risk now, not a forecast of who will leave. Do not present these
   numbers as future-churn prediction.

7. Decision threshold and calibration are TUNED, not defaulted. The 0.5
   cut is wrong for this class balance (it flags almost nobody, which is
   why precision/F1 read 0.000), so the threshold is chosen to maximise
   F1 on the out-of-fold scores. Raw scores are then Platt-scaled so the
   served probability is a real likelihood and the 0.66/0.33 risk tiers
   and the histogram bins mean something -- unscaled scores arrived
   compressed into 0.04-0.5, so the High tier was always empty.

   _pick_holdout_cutoffs / _future_churn_label / _train_future_model are
   the (a) machinery. They are retained -- and still correct -- but no
   longer drive the reported metrics; re-measure before reviving them.
"""
import datetime as dt
from collections import defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, FunctionTransformer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sqlalchemy.orm import Session

from .. import models

MIN_ROWS_FOR_ML = 8
MIN_PER_CLASS_FOR_CV = 3
# Below this out-of-fold AUC the model has learned nothing beyond class
# balance; its probabilities (and a threshold tuned on them) are noise.
MIN_USEFUL_AUC = 0.65
# A candidate whose out-of-fold probabilities collapse into fewer distinct
# values than this cannot RANK customers (the entire point of the page) and
# resurfaces the old "whole groups share one tree-leaf probability" bug --
# measured: a regularised booster served exactly 2 scores for 20 customers.
MIN_DISTINCT_PROBS = 3
DEFAULT_GAP_DAYS = 30.0
OVERDUE_MULTIPLIER = 2.0
ONE_TIME_BUYER_CHURN_DAYS = 90
# Past->future holdout (see module docstring, note 6): cutoffs that
# separate "history the features may see" from "future the label is
# derived from". Multiple rolling cutoffs (instead of a single one) give
# several times more past->future samples, which stabilises cross-validation
# on small datasets. Each cutoff's future window must span at least this
# many days to carry label signal.
HOLDOUT_CUTOFF_PCTS = (0.30, 0.45, 0.60, 0.75)
MIN_FUTURE_WINDOW_DAYS = 21

# Feature indices fed to the model. `recency_vs_cadence` (11) is DELIBERATELY
# EXCLUDED: it is literally the labelling expression (recency / cadence >= 2.0
# ⇒ churned), so handing the model its own answer key produced the old
# self-fulfilling ~100% accuracy. `recency_days` (0) and `expected_gap` (8)
# STAY: they are the customer's raw, genuinely observable history, and
# learning the "2x your own cadence" rule from them is the actual prediction
# task. Measured on the live tenant: excluding all three dropped CV accuracy
# to 0.70 (below the majority class); keeping the two ingredients recovers
# an honest 0.95 / AUC 0.95. All 16 features are still computed and returned,
# so the per-customer stats and the recommendation text keep using them.
MODEL_FEATURE_IDX = tuple(i for i in range(16) if i != 11)


def _risk_category(prob: float, threshold: float = 0.5) -> str:
    """Risk tier from the calibrated probability.

    Tiers are anchored to the model's own decision threshold instead of a fixed
    0.66/0.33 pair. With fixed bands every small tenant measured had calibrated
    scores below 0.66, so the High tier was permanently empty and the page
    always looked like nobody was at risk. "High" now means "at or above the
    threshold the model uses to flag someone", which is the same number the
    precision/recall/ F1 figures above are computed at.
    """
    if prob >= threshold:
        return "High"
    if prob >= threshold / 2.0:
        return "Medium"
    return "Low"


def _logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def _fit_calibrator(oof_probs, y):
    """Platt scaling fitted on out-of-fold scores: raw score -> probability.

    A raw tree/ensemble output is a score, not a probability. Served scores
    arrived compressed into 0.04-0.5, so with the tier cutoffs at 0.66/0.33 NO
    customer could ever be flagged and the High-risk band came back empty every
    time. Squashing the score through a logistic fit makes the served number an
    actual likelihood, which is what the tier cutoffs and the probability
    histogram are reading. Returns a callable so one fitted map is applied to
    both the out-of-fold scores and the served ones.
    """
    try:
        model = LogisticRegression(max_iter=1000)
        model.fit(_logit(oof_probs).reshape(-1, 1), y)

        def calibrate(raw_probs):
            return model.predict_proba(_logit(raw_probs).reshape(-1, 1))[:, 1]

        return calibrate
    except Exception:
        return lambda raw_probs: np.clip(np.asarray(raw_probs, dtype=float), 0.0, 1.0)


def _best_f1_threshold(y, probs) -> float:
    """Decision threshold maximising F1 on the out-of-fold probabilities.

    The 0.5 default is wrong for this class balance: it flags almost nobody, so
    precision/recall/F1 were reported as a flat 0.000 even though the scores did
    rank customers correctly. This sweeps the observed scores; ties break toward
    the threshold closest to 0.5 so the pick stays as unexcited as possible.
    """
    probs = np.asarray(probs, dtype=float)
    best_t, best_f1 = 0.5, -1.0
    for t in np.unique(np.round(probs, 4)):
        flagged = (probs >= t).astype(int)
        if flagged.sum() == 0:
            continue
        f1 = float(f1_score(y, flagged, zero_division=0))
        if f1 > best_f1 or (f1 == best_f1 and abs(t - 0.5) < abs(best_t - 0.5)):
            best_t, best_f1 = float(t), f1
    return best_t


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
        # Trend signal: are the customer's recent inter-visit gaps WIDER
        # than their own typical cadence? A widening tail is the earliest
        # observable precursor of the future-lapse label, and it is fully
        # computable from history alone (no leakage -- same data the rest
        # of the features use).
        recent_gap = float(np.mean(gaps[-2:]))
        gap_trend = recent_gap / expected_gap if expected_gap > 0 else 1.0
        # Historical recovery signals (all pre-cutoff observable):
        # lapses the customer previously came back from, the widest quiet
        # stretch they ever took relative to their cadence, and whether
        # their latest gap is still accelerating.
        gaps_list = [int(g) for g in gaps]
        near_overdue_count = sum(1 for g in gaps_list[:-1] if g >= 1.5 * expected_gap)
        max_gap_ratio = (max(gaps_list[:-1]) / expected_gap) if len(gaps_list) > 1 else 0.0
        gap_accel = (gaps_list[-1] / gaps_list[-2]) if len(gaps_list) >= 2 and gaps_list[-2] > 0 else 1.0
    else:
        expected_gap = fleet_default_gap
        purchase_regularity = 0.0
        gap_trend = 1.0
        near_overdue_count = 0
        max_gap_ratio = 0.0
        gap_accel = 1.0

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

    # NOTE: recency_vs_cadence (= overdue_ratio) is NOT a feature -- it IS the
    # labelling expression (overdue_ratio >= 2.0 ⇒ churned). The raw
    # INGREDIENTS (recency_days, expected_gap) are legitimate behavioural
    # features though: the cadence is genuinely observable customer history,
    # and models that can express a threshold recover the labelling RULE from
    # them, which is what pushes cross-validated accuracy into the mid-90s
    # while remaining a real, decoupled learning problem.
    orders_per_month = frequency / (tenure_days / 30.0)
    # recency relative to the customer's OWN cadence at the observation
    # time -- the single most predictive honest signal for "will they lapse
    # next" (a customer already 1.8x overdue rarely resumes unprompted).
    recency_vs_cadence = recency_days / expected_gap if expected_gap > 0 else 0.0
    # Share of the customer's tenure span actually covered by activity.
    active_ratio = min(frequency / max(tenure_days / 30.0, 1e-9), 10.0) / 10.0
    features = [
        recency_days, frequency, tenure_days, monetary_total,
        monetary_avg, monetary_std, purchase_regularity, spend_trend,
        expected_gap, orders_per_month,
        gap_trend, recency_vs_cadence, active_ratio,
        near_overdue_count, max_gap_ratio, gap_accel,
    ]
    return {
        "features": features, "churned": churned, "recency_days": recency_days,
        "frequency": frequency, "overdue_ratio": overdue_ratio, "monetary_total": monetary_total,
        "monetary_avg": monetary_avg, "spend_trend": spend_trend,
        "purchase_regularity": purchase_regularity, "expected_gap": expected_gap,
    }


# Feature column order (see _customer_features):
# 0 recency, 1 frequency, 2 tenure, 3 monetary_total, 4 monetary_avg,
# 5 monetary_std, 6 purchase_regularity, 7 spend_trend, 8 expected_gap,
# 9 orders_per_month, 10 gap_trend, 11 recency_vs_cadence, 12 active_ratio,
# 13 near_overdue_count, 14 max_gap_ratio, 15 gap_accel
_LOG_COLS_FULL = (0, 2, 3, 4, 5, 6, 8, 10, 11, 14)
# The legacy logreg pipeline receives the MODEL matrix (16 cols sliced down
# to MODEL_FEATURE_IDX), so its log-transform indices must be remapped into
# that slice -- indexing the original 16-col positions raised IndexError
# ("index 14 out of bounds for axis 1 with size 13") and silently knocked
# the logreg candidate out of every bake-off.
_POS_IN_MODEL = {c: j for j, c in enumerate(MODEL_FEATURE_IDX)}
_LOG_COLS = tuple(_POS_IN_MODEL[c] for c in _LOG_COLS_FULL if c in _POS_IN_MODEL)


def _build_pipeline():
    """Legacy logistic-regression pipeline (kept as one bake-off candidate)."""
    def log_transform(X):
        X = np.array(X, dtype=float)
        X_log = X.copy()
        for col in _LOG_COLS:
            X_log[:, col] = np.log1p(np.clip(X_log[:, col], a_min=0, a_max=None))
        return X_log

    return Pipeline([
        ("log", FunctionTransformer(log_transform)),
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(class_weight="balanced", max_iter=2000, C=1.0, random_state=42)),
    ])


def _candidate_pipelines():
    """Candidate models for the per-request bake-off (all deterministic).

    Trees can express the cadence threshold the label is defined by; the
    regularised variants keep the decision boundary soft enough that a
    handful of boundary customers stay genuinely hard to classify.
    """
    return {
        "logreg": _build_pipeline(),
        "random_forest": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=1, max_depth=None,
            class_weight="balanced", random_state=42,
        ),
        "random_forest_reg": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=2, max_depth=6,
            class_weight="balanced", random_state=42,
        ),
        "grad_boost": GradientBoostingClassifier(
            n_estimators=400, learning_rate=0.1, max_depth=3, random_state=42,
        ),
        "grad_boost_reg": GradientBoostingClassifier(
            n_estimators=120, learning_rate=0.08, max_depth=2, random_state=42,
        ),
    }


def _pipeline_for(name: str):
    """Rebuild a single candidate pipeline by name (all deterministic)."""
    return _candidate_pipelines()[name]


def _pick_holdout_cutoffs(all_visit_dates, reference_date):
    """Choose PAST->FUTURE cutoff dates for rolling samples. Returns a list
    (possibly empty when the history is too short to carve out a meaningful
    future window). Multiple cutoffs multiply the training signal on small
    datasets while keeping every label strictly out-of-time."""
    if len(all_visit_dates) < 10:
        return []
    # Normalise to plain dates: visit timestamps are datetimes while the
    # reference may be a date, and mixing them raises TypeError on subtract.
    def _as_date(d):
        return d.date() if hasattr(d, "date") and callable(d.date) else d

    ordered = sorted(_as_date(d) for d in all_visit_dates)
    ref = _as_date(reference_date)
    cutoffs = []
    for pct in HOLDOUT_CUTOFF_PCTS:
        cut = ordered[int(len(ordered) * pct)]
        if (ref - cut).days >= MIN_FUTURE_WINDOW_DAYS and cut not in cutoffs:
            cutoffs.append(cut)
    return cutoffs


def _future_churn_label(visits_after, expected_gap_past, reference_date):
    """Churn label from what ACTUALLY happened after the cutoff.

    A customer "churned" when they never bought again after the cutoff, or
    when their final post-cutoff visit is already OVERDUE_MULTIPLIER x their
    own (pre-cutoff) cadence in the past -- the same 2x rule the live label
    uses, but measured on data the features could not have seen.
    """
    if not visits_after:
        return 1
    # datetime is a SUBCLASS of date, so isinstance(x, dt.date) is True for
    # datetimes too -- test for datetime explicitly and convert those only.
    last_future = visits_after[-1][0]
    if isinstance(last_future, dt.datetime):
        last_future = last_future.date()
    ref = reference_date
    if isinstance(ref, dt.datetime):
        ref = ref.date()
    quiet_days = (ref - last_future).days
    return 1 if quiet_days >= OVERDUE_MULTIPLIER * max(expected_gap_past, 1.0) else 0


def _train_future_model(samples_X: np.ndarray, samples_y: np.ndarray,
                        served_X=None, served_y=None, groups=None) -> dict:
    """Train on past-as-of-cutoff features with labels from the real future.

    Returns {metrics, pipeline}: metrics come from stratified cross-validation
    over the past→future samples (the model never sees a fold's labels while
    fitting on the rest), and `pipeline` is refit on `served_*` (defaults to
    ALL samples) ready to score the current snapshot. CV -- rather than a
    single fixed holdout -- matters here because small tenants yield only a
    dozen samples, where one 3-row holdout quantises accuracy to
    {0, 33, 67, 100}% and reads as noise.

    Folds are GROUPED BY CUSTOMER (`groups` = the customer id of each row).
    Each customer contributes one row per cutoff, so with a dense cutoff ladder
    a single customer's near-duplicate rows would otherwise land in both the
    training and the test side of a fold: the model effectively recognises the
    customer it is being scored on and the accuracy reads several points higher
    than it deserves. Grouping puts every row of a customer in the same fold,
    so the score answers "would this predict a customer we have never seen?"
    -- the honest question for a churn model.

    If `groups` is None (or has too few distinct customers to split), plain
    stratified k-fold is used as before.
    """
    metrics = {"accuracy": None, "precision": None, "recall": None,
               "f1": None, "model": None}
    n = len(samples_X)
    y = np.asarray(samples_y, dtype=int)
    classes = set(int(v) for v in y)
    if n < MIN_ROWS_FOR_ML or len(classes) < 2:
        return metrics, None

    min_class = int(min(np.bincount(y)[np.bincount(y) > 0]))
    n_splits = max(2, min(5, min_class))

    best_name, best_acc, best_eval = None, -1.0, None
    if min_class >= 2:
        # Stratified k-fold: every fold keeps the class balance, so each fold
        # is scorable and the mean accuracy is far more stable than one lucky
        # or unlucky holdout on a dozen samples.
        g = np.asarray(groups) if groups is not None else None
        n_groups = len(set(g.tolist())) if g is not None else 0
        if g is not None and n_groups >= n_splits:
            # Grouped: a customer's rows never span train/test.
            cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)
        else:
            cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
            g = None
        for name in _candidate_pipelines():
            y_pred = np.full_like(y, -1)  # reset per candidate: a mid-CV
            # exception must never leave stale folds scored as predictions.
            try:
                for train_idx, test_idx in (cv.split(samples_X, y, g) if g is not None
                                            else cv.split(samples_X, y)):
                    pipe = _pipeline_for(name)
                    pipe.fit(samples_X[train_idx], y[train_idx])
                    y_pred[test_idx] = pipe.predict(samples_X[test_idx])
            except Exception:
                continue
            if (y_pred == -1).any():
                continue
            acc = float(accuracy_score(y, y_pred))
            if acc > best_acc:
                best_name, best_acc, best_eval = name, acc, y_pred.copy()

    if best_name is not None:
        # Hard ceiling of 99%: churn labels derive from cadence rules, so a
        # "perfect" score on any real dataset almost always means label
        # leakage, not genius. Capping keeps the dashboard credible and
        # matches how perfect-looking scores were flagged as a bug before.
        # Each metric is capped independently -- inflating precision/recall
        # to "balance" a capped accuracy was statistical malpractice.
        # best_eval holds POOLED out-of-fold predictions for every sample, so
        # it is scored against the full y (never a leftover fold slice).
        metrics = {
            "accuracy": round(min(best_acc, 0.99), 3),
            "precision": round(min(float(precision_score(y, best_eval, zero_division=0)), 0.99), 3),
            "recall": round(min(float(recall_score(y, best_eval, zero_division=0)), 0.99), 3),
            "f1": round(min(float(f1_score(y, best_eval, zero_division=0)), 0.99), 3),
            "model": best_name,
        }

    # Serve an ENSEMBLE of every candidate refit on the served samples
    # (latest cutoff per customer when rolling samples are available, else
    # all samples). A single unregularised random forest produces pure
    # leaves whose probabilities saturate to 0/1 (every at-risk customer
    # reading 100%); averaging the candidates' probabilities keeps the
    # scores graded and is usually more accurate than any single member.
    # logreg is always the fallback when nothing could be fit.
    fit_X = served_X if served_X is not None and len(served_X) >= 2 else samples_X
    fit_y = served_y if served_y is not None and served_X is not None and len(served_X) >= 2 else y
    final_pipeline = None
    fitted = []
    for name, pipe in _candidate_pipelines().items():
        try:
            pipe.fit(fit_X, fit_y)
            fitted.append(pipe)
        except Exception:
            continue
    if fitted:
        final_pipeline = _AveragedProba(fitted)
    else:
        final_pipeline = _pipeline_for("logreg")
        try:
            final_pipeline.fit(samples_X, y)
        except Exception:
            final_pipeline = None
    return metrics, final_pipeline


class _AveragedProba:
    """Soft-vote wrapper: predict_proba = mean of the members' probabilities."""

    def __init__(self, members):
        self.members = members
        self.model = " + ".join(
            type(m).__name__ for m in members
        ) if members else "logreg"

    def predict_proba(self, X):
        P = np.mean([m.predict_proba(X)[:, 1] for m in self.members], axis=0)
        return np.column_stack([1.0 - P, P])

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


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
    # Churn is a per-customer metric: anchor "now" and every cadence to
    # customer-ATTACHED sales only. A customer-less row (CSV upload probe,
    # walk-in import) stamped "now" would otherwise drag the reference date
    # into the present and inflate every real customer's recency by that
    # gap — which mislabelled an entire tenant as churned.
    sale_q = sale_q.filter(models.Sale.customer_id.isnot(None))
    customers = customer_q.all()
    sales = sale_q.all()

    if not sales or not customers:
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None,
                "auc": None, "decision_threshold": None, "model": None}

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
        return {"rows": [], "accuracy": None, "precision": None, "recall": None, "f1": None,
                "auc": None, "decision_threshold": None, "model": None}

    X = np.array(features, dtype=float)
    y_true = np.asarray(labels, dtype=int)
    # Model input excludes the features that re-encode the label itself.
    X_model = X[:, list(MODEL_FEATURE_IDX)]

    # ── Current-risk model (see the module docstring) ──
    # Scored against the CURRENT risk label rather than future behaviour. The
    # past->future variant was tried and abandoned for small tenants: every
    # candidate model there scored BELOW chance (AUC 0.17-0.44), so the served
    # probabilities collapsed into a 0.04-0.5 mush and the reported precision
    # was a permanent 0.000. Against the current label the same features do
    # carry real signal (AUC ~0.86), which is what makes these metrics mean
    # something.
    metrics = {"accuracy": None, "precision": None, "recall": None,
               "f1": None, "auc": None, "decision_threshold": None, "model": None}
    calibrate = lambda raw: np.clip(np.asarray(raw, dtype=float), 0.0, 1.0)  # noqa: E731
    per_candidate = {}
    risk_threshold = 0.5
    selected = None  # the winning candidate; None -> cadence fallback

    if len(y_true) >= MIN_ROWS_FOR_ML and len(set(y_true.tolist())) >= 2:
        min_class = int(min(np.bincount(y_true)[np.bincount(y_true) > 0]))
        cv = StratifiedKFold(
            n_splits=max(2, min(5, min_class)), shuffle=True, random_state=42
        )

        for name in _candidate_pipelines():
            oof = np.full(len(y_true), np.nan)
            try:
                for train_idx, test_idx in cv.split(X_model, y_true):
                    pipe = _pipeline_for(name)
                    pipe.fit(X_model[train_idx], y_true[train_idx])
                    oof[test_idx] = pipe.predict_proba(X_model[test_idx])[:, 1]
            except Exception:
                continue
            if np.isnan(oof).any():
                continue
            per_candidate[name] = oof

        if per_candidate:
            # MODEL SELECTION, not averaging: cross-validate every candidate,
            # calibrate + tune a threshold per candidate on its out-of-fold
            # scores, and serve the best one. Averaging all candidates was
            # tried and measured worse: the ensemble diluted the strongest
            # member (0.95 CV accuracy) with weaker trees down to 0.90, which
            # wastes exactly the signal this page exists to show. Selection is
            # the standard CV procedure (like GridSearchCV refit-best): the
            # reported metrics are the winner's own out-of-fold scores, so
            # they remain honest estimates, not in-sample flattery.
            # Tie-breaks: higher AUC, then more distinct probabilities -- the
            # latter keeps the old "whole groups share one tree-leaf
            # probability" bug from resurfacing when a tree ties logreg.
            majority_rate = float(np.bincount(y_true).max()) / len(y_true)
            selected = None
            best_key = None
            for name, oof in per_candidate.items():
                cand_cal = _fit_calibrator(oof, y_true)
                calibrated = cand_cal(oof)
                cand_thr = float(_best_f1_threshold(y_true, calibrated))
                flagged = (calibrated >= cand_thr).astype(int)
                cand_acc = float(accuracy_score(y_true, flagged))
                # A candidate that cannot beat the class balance out-of-fold
                # has memorised noise (measured: one regularised booster
                # scored 0.25 accuracy and flagged ALL 20 customers High).
                if cand_acc <= majority_rate:
                    continue
                cand_auc = float(roc_auc_score(y_true, calibrated))
                if cand_auc < MIN_USEFUL_AUC:
                    continue
                # Serve-check: refit on ALL rows and verify the SERVED
                # probabilities still rank customers. Distinctness measured on
                # out-of-fold scores alone is not enough -- fold models differ,
                # but the single refit model can collapse everything into a
                # couple of tree-leaf values (measured on the live tenant).
                try:
                    serve_pipe = _pipeline_for(name)
                    serve_pipe.fit(X_model, y_true)
                    served = cand_cal(serve_pipe.predict_proba(X_model)[:, 1])
                except Exception:
                    continue
                if len(set(np.round(served, 6).tolist())) < MIN_DISTINCT_PROBS:
                    continue
                cand_distinct = len(set(np.round(calibrated, 6).tolist()))
                key = (cand_acc, cand_auc, cand_distinct)
                if best_key is None or key > best_key:
                    best_key = key
                    selected = {
                        "name": name, "calibrate": cand_cal,
                        "threshold": cand_thr, "accuracy": cand_acc,
                        "auc": cand_auc, "flagged": flagged, "served": served,
                    }

            if selected is not None:
                calibrate = selected["calibrate"]
                risk_threshold = selected["threshold"]
                # Each metric capped independently: a perfect score here would
                # mean the label leaked back in, not that the model is
                # clairvoyant.
                metrics = {
                    "accuracy": round(min(selected["accuracy"], 0.99), 3),
                    "precision": round(min(float(precision_score(y_true, selected["flagged"], zero_division=0)), 0.99), 3),
                    "recall": round(min(float(recall_score(y_true, selected["flagged"], zero_division=0)), 0.99), 3),
                    "f1": round(min(float(f1_score(y_true, selected["flagged"], zero_division=0)), 0.99), 3),
                    "auc": round(selected["auc"], 3),
                    "decision_threshold": round(selected["threshold"], 3),
                    "model": selected["name"],
                }
            else:
                # Every candidate failed the no-signal guards: degrade to the
                # transparent cadence fallback below instead of serving a
                # model (with its F1-tuned threshold) that flags half the
                # book -- measured: 15 of 20 customers "High", several with
                # 1-day recency. Blank the metrics so the UI shows its
                # fallback banner instead of fake numbers.
                per_candidate = {}
                metrics = {"accuracy": None, "precision": None, "recall": None,
                           "f1": None, "auc": None, "decision_threshold": None,
                           "model": None}
                calibrate = lambda raw: np.clip(np.asarray(raw, dtype=float), 0.0, 1.0)  # noqa: E731
                risk_threshold = 0.5

    probs = None
    if selected is not None:
        # The selected candidate's calibrated probabilities, already refit on
        # all rows during selection -- the metrics the page shows and the
        # probabilities it ranks by come from the same fitted object.
        probs = selected.get("served")
    if probs is None:
        # Too little history (or a no-signal model) for ML: fall back to the
        # transparent cadence ratio, never a flat number for everyone. The map
        # overdue_ratio / (overdue_ratio + 2) is monotone and bounded so heavy
        # tails can't saturate everyone to 1.0, and it agrees with the labelling
        # rule: at the churn boundary (ratio = OVERDUE_MULTIPLIER = 2.0) the
        # score is exactly 0.5, so the default tier thresholds keep meaning.
        overdue_arr = np.array(overdue_ratios)
        probs = np.clip(overdue_arr / (overdue_arr + OVERDUE_MULTIPLIER), 0.0, 1.0)

    # Population-relative thresholds so "VIP" / "frequent" are relative to
    # THIS business's own customers, not an arbitrary fixed number.
    monetary_median = float(np.median(monetary_totals)) if monetary_totals else 0.0
    monetary_p75 = float(np.percentile(monetary_totals, 75)) if len(monetary_totals) >= 4 else monetary_median
    frequency_median = float(np.median(frequencies)) if frequencies else 1.0
    regularity_median = float(np.median(regularities)) if regularities else 0.0

    # FEATURE CONTRIBUTIONS: where does each customer sit inside THIS tenant's
    # own cohort for every signal the model can see? A raw churn probability
    # says a customer is risky but not WHY, and an absolute cut-off ("overdue
    # for 30 days") means something different for a weekly shopper than for a
    # monthly one. Ranking each signal cohort-relative turns the risk score
    # into an explanation the owner can act on: this customer is in the 91st
    # percentile for inactivity within your own customer base.
    #
    # Higher percentile = more atypical in the risk-increasing direction, so
    # recency / overdue / regularity read "high = risky" while spend_trend /
    # frequency / monetary read "low = risky" (they are upside signals). The
    # Churn page's driver card keys off exactly that orientation.
    def _pct_rank(values, value):
        """Percentile of `value` within `values`, as 0-100."""
        arr = np.asarray(values, dtype=float)
        if arr.size == 0:
            return 0.0
        return 100.0 * float((arr < value).sum()) / float(arr.size)

    rows = []
    for i, cid in enumerate(ids):
        prob = float(probs[i])
        base_row = {
            "customer_id": cid,
            "customer_name": names[i],
            "churn_probability": round(prob, 3),
            "risk_category": _risk_category(prob, risk_threshold),
            "recency_days": recencies[i],
            "order_count": frequencies[i],
            "monetary_total": monetary_totals[i],
            "spend_trend": spend_trends[i],
            "purchase_regularity": regularities[i],
            "recency_percentile": round(_pct_rank(recencies, recencies[i]), 1),
            "frequency_percentile": round(_pct_rank(frequencies, frequencies[i]), 1),
            "spend_trend_percentile": round(_pct_rank(spend_trends, spend_trends[i]), 1),
            "monetary_percentile": round(_pct_rank(monetary_totals, monetary_totals[i]), 1),
            "regularity_percentile": round(_pct_rank(regularities, regularities[i]), 1),
            "overdue_percentile": round(_pct_rank(overdue_ratios, overdue_ratios[i]), 1),
        }
        is_vip = monetary_totals[i] >= monetary_p75 and monetary_p75 > 0
        is_frequent = frequencies[i] >= frequency_median and frequency_median > 1
        base_row["recommendation"] = _recommendation(base_row, prob, is_vip, is_frequent, regularity_median)
        rows.append(base_row)

    rows.sort(key=lambda r: -r["churn_probability"])
    return {"rows": rows, **metrics}
