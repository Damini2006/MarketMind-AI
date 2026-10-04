"""Product recommendation engine.

Every customer is scored through up to four independent channels, each
normalised to 0-1 and then blended:

  1. Co-purchase lift   — products statistically associated with the
     customer's own purchases (needs multi-item sales).
  2. Category affinity  — popular items in the categories THIS customer
     spends in, weighted by their personal spend share.
  3. Reorder cycle      — the customer's own repeat items, ranked by how
     overdue each one is relative to the business's newest sale.
  4. Popularity         — top sellers, used mainly as a last resort.

WHY (the "everyone sees the same recommendations" bug):
With one SaleItem row per Sale the co-purchase matrix is empty, and the old
first-match-wins chain sent every customer to the same global top-sellers
list. Even with multi-item sales, RAW co-occurrence counts rank staples
("Dish Soap", "USB Cable") first for everyone, because staples appear in
many baskets — a ranking with no per-customer information. Two fixes:
lift removes each candidate's own popularity from the co-purchase score,
and blending all channels means a customer's recommendations differ as soon
as ANY channel separates them — no shared dead fallback in the middle.

All functions are stateless — computed on the fly from current sales data.
Optimised to minimise round-trips to remote Postgres (Neon).
"""

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from . import models

LIFT_MIN_SCORE = 1.1          # co-purchase lift must beat this to count as "strong"
REORDER_MIN_QTY = 2.0         # total qty before a product counts as a repeat item

# Blend weights: personalised channels dominate; popularity only fills gaps.
_W_COPURCHASE = 2.0
_W_ALSOBOUGHT = 1.2
_W_CATEGORY = 1.0
_W_REORDER = 1.5
_W_POPULARITY = 0.4


# ---------------------------------------------------------------------------
# Internal helpers — batched for performance
# ---------------------------------------------------------------------------

def _popularity_scores(db: Session, business_id: int) -> Dict[int, float]:
    """Return {product_id: total quantity sold} from sale line items."""
    rows = (
        db.query(
            models.SaleItem.product_id,
            sa_func.coalesce(sa_func.sum(models.SaleItem.quantity), 1),
        )
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
        .filter(models.Sale.business_id == business_id)
        .group_by(models.SaleItem.product_id)
        .all()
    )
    return {pid: float(qty) for pid, qty in rows if pid is not None}


def _popularity_from_sales(db: Session, business_id: int) -> Dict[int, float]:
    """Fallback popularity from Sale.product_id rows (sales without line items)."""
    rows = (
        db.query(
            models.Sale.product_id,
            sa_func.coalesce(sa_func.sum(models.Sale.quantity), 1),
        )
        .filter(models.Sale.business_id == business_id)
        .group_by(models.Sale.product_id)
        .all()
    )
    return {pid: float(qty) for pid, qty in rows if pid is not None}


def _product_category_map(db: Session, business_id: int) -> Dict[int, str]:
    """Return {product_id: category} for all products in the business (1 query)."""
    rows = (
        db.query(models.Product.id, models.Product.category)
        .filter(models.Product.business_id == business_id)
        .all()
    )
    return {pid: (cat or "Uncategorized") for pid, cat in rows}


def _product_info_map(db: Session, business_id: int) -> Dict[int, dict]:
    """{product_id: {name, price, category, stock_quantity}} in ONE query.

    Plain dicts rather than ORM instances: this map is cached with the rest of
    the recommendation context across requests, and a detached instance would
    raise on attribute access once its session closed. Hydrating from here
    also removes a Product query per customer -- with ~30 customers per page
    (page + backtest folds) that was ~10s of pure round-trip latency on Neon.
    """
    rows = (
        db.query(
            models.Product.id,
            models.Product.name,
            models.Product.price,
            models.Product.category,
            models.Product.stock_quantity,
        )
        .filter(models.Product.business_id == business_id)
        .all()
    )
    return {
        pid: {
            "name": name,
            "price": price,
            "category": cat,
            "stock_quantity": stock,
        }
        for pid, name, price, cat, stock in rows
    }


def _category_popularity(
    pop: Dict[int, float], cat_map: Dict[int, str]
) -> Dict[str, Dict[int, float]]:
    """Return {category: {product_id: score}} — built from pre-fetched data."""
    result: Dict[str, Dict[int, float]] = defaultdict(dict)
    for pid, score in pop.items():
        cat = cat_map.get(pid, "Uncategorized")
        result[cat][pid] = score
    return result


def _purchased_product_ids_batch(
    db: Session, business_id: int, customer_ids: List[int]
) -> Dict[int, Dict[int, float]]:
    """Return {customer_id: {product_id: total_qty}} for all customers.

    Qty per product matters: the reorder channel needs repeat-purchase
    signal, which a plain set of product ids throws away. Legacy sales that
    only carry Sale.product_id (no line items) are merged in without
    double-counting.
    """
    if not customer_ids:
        return {}
    rows = (
        db.query(
            models.Sale.customer_id,
            models.SaleItem.product_id,
            sa_func.coalesce(models.SaleItem.quantity, 1),
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.in_(customer_ids),
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    result: Dict[int, Dict[int, float]] = defaultdict(dict)
    for cid, pid, qty in rows:
        if cid is None:
            continue
        d = result[cid]
        d[pid] = d.get(pid, 0.0) + float(qty or 1)
    for cid, pmap in _legacy_purchases_by_customer(db, business_id, customer_ids).items():
        d = result.setdefault(cid, {})
        for pid, q in pmap.items():
            d[pid] = d.get(pid, 0.0) + q
    return result


def _purchased_product_ids(db: Session, business_id: int, customer_id: int) -> Dict[int, float]:
    """Return {product_id: total_qty} a single customer has purchased."""
    return _purchased_product_ids_batch(db, business_id, [customer_id]).get(
        customer_id, {}
    )


def _legacy_purchases_by_customer(
    db: Session, business_id: int, customer_ids: List[int]
) -> Dict[int, Dict[int, float]]:
    """Purchases recorded only on Sale.product_id (rows with no SaleItem line),
    so a normal line-item sale is never counted twice.

    The "has no line item" test is a correlated NOT EXISTS rather than a
    ``NOT IN (SELECT sale_id FROM sale_items)``: the old form materialised
    every line-item sale id of the business and pushed hundreds of bind
    parameters into the query, which Postgres cannot index its way out of.
    """
    rows = (
        db.query(
            models.Sale.customer_id,
            models.Sale.product_id,
            sa_func.coalesce(models.Sale.quantity, 1),
        )
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.in_(customer_ids),
            models.Sale.product_id.isnot(None),
            ~models.Sale.sale_items.any(),
        )
        .all()
    )
    result: Dict[int, Dict[int, float]] = defaultdict(dict)
    for cid, pid, qty in rows:
        if cid is None:
            continue
        d = result[cid]
        d[pid] = d.get(pid, 0.0) + float(qty or 1)
    return result


def _purchase_dates_by_customer_product(
    db: Session, business_id: int
) -> Dict[Tuple[int, int], List[dt.datetime]]:
    """{(customer_id, product_id): [purchase datetimes]} in one query."""
    rows = (
        db.query(
            models.Sale.customer_id,
            models.SaleItem.product_id,
            models.Sale.sale_date,
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.isnot(None),
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    result: Dict[Tuple[int, int], List[dt.datetime]] = defaultdict(list)
    for cid, pid, d in rows:
        if d is not None:
            result[(cid, pid)].append(d)
    for k in result:
        result[k].sort()
    return result


def _reorder_context(
    dates_by_cp: Dict[Tuple[int, int], List[dt.datetime]],
) -> Tuple[Dict[Tuple[int, int], float], Dict[Tuple[int, int], dt.datetime], dt.datetime]:
    """Precompute what the reorder channel needs:
      - expected repurchase gap per (customer, product): median of that pair's
        own inter-purchase gaps, falling back to the product's business-wide
        median gap, then the fleet median, then 14 days;
      - last purchase datetime per (customer, product);
      - the business-wide newest purchase (the 'now' anchor).
    """
    pair_gaps: Dict[Tuple[int, int], List[float]] = defaultdict(list)
    all_gaps: List[float] = []
    product_gaps: Dict[int, List[float]] = defaultdict(list)
    last: Dict[Tuple[int, int], dt.datetime] = {}
    newest: dt.datetime = None
    for (cid, pid), ds in dates_by_cp.items():
        last[(cid, pid)] = ds[-1]
        if newest is None or ds[-1] > newest:
            newest = ds[-1]
        for i in range(1, len(ds)):
            gap = (ds[i] - ds[i - 1]).days
            if gap > 0:
                pair_gaps[(cid, pid)].append(float(gap))
                product_gaps[pid].append(float(gap))
                all_gaps.append(float(gap))

    fleet_default = float(np.median(all_gaps)) if all_gaps else 14.0
    fleet_default = max(fleet_default, 1.0)

    def _expected(pair_key: Tuple[int, int], pid: int) -> float:
        if pair_gaps.get(pair_key):
            return max(float(np.median(pair_gaps[pair_key])), 1.0)
        if product_gaps.get(pid):
            return max(float(np.median(product_gaps[pid])), 1.0)
        return fleet_default

    expected = {
        key: _expected(key, pid)
        for (key, pid) in ((k, k[1]) for k in dates_by_cp)
    }
    return expected, last, newest


def _category_spend_batch(
    db: Session, business_id: int, customer_ids: List[int], cat_map: Dict[int, str]
) -> Dict[int, Dict[str, float]]:
    """{customer_id: {category: spend}} — each customer's own spend mix."""
    result: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    rows = (
        db.query(
            models.Sale.customer_id,
            models.SaleItem.product_id,
            sa_func.coalesce(models.SaleItem.quantity, 1),
            sa_func.coalesce(models.SaleItem.unit_price, 0),
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.in_(customer_ids),
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    for cid, pid, qty, price in rows:
        if cid is None:
            continue
        cat = cat_map.get(pid, "Uncategorized")
        result[cid][cat] += float(qty or 1) * float(price or 0)
    # Legacy single-row sales (no SaleItem) contribute their totals too.
    q = (
        db.query(
            models.Sale.customer_id,
            models.Sale.product_id,
            sa_func.coalesce(models.Sale.total_amount, 0),
        )
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.in_(customer_ids),
            models.Sale.product_id.isnot(None),
            ~models.Sale.sale_items.any(),
        )
    )
    for cid, pid, amount in q.all():
        if cid is None:
            continue
        cat = cat_map.get(pid, "Uncategorized")
        result[cid][cat] += float(amount or 0)
    return result


# ---------------------------------------------------------------------------
# Co-purchase matrix with lift normalisation
# ---------------------------------------------------------------------------

def _customer_product_pairs(
    db: Session, business_id: int
) -> Tuple[Dict[int, set], int]:
    """({product_id: set of customer_ids who bought it}, n_customers_with_purchases).

    Spans line-item sales AND legacy Sale.product_id rows (de-duplicated), so
    the also-bought channel works even when every sale is a single item.
    """
    buyers: Dict[int, set] = defaultdict(set)
    rows = (
        db.query(
            models.Sale.customer_id,
            models.SaleItem.product_id,
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.isnot(None),
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    for cid, pid in rows:
        buyers[pid].add(cid)

    q = db.query(
        models.Sale.customer_id,
        models.Sale.product_id,
    ).filter(
        models.Sale.business_id == business_id,
        models.Sale.customer_id.isnot(None),
        models.Sale.product_id.isnot(None),
        ~models.Sale.sale_items.any(),
    )
    for cid, pid in q.all():
        buyers[pid].add(cid)

    n_customers = len(
        {cid for s in buyers.values() for cid in s}
    )
    return dict(buyers), n_customers


def _also_bought_scores(
    purchased: Dict[int, float],
    buyers_by_product: Dict[int, set],
    n_customers: int,
) -> Dict[int, float]:
    """{candidate: summed lift} over "customers who bought X also bought Y".

    User-based collaborative filtering that, unlike basket co-purchase, works
    even when every sale is a single line item. Score conditions on the
    customer's OWN items, so it separates customers the category channel
    cannot (different products, same category).
    """
    scores: Dict[int, float] = {}
    if n_customers <= 0:
        return scores
    for pid, buyers_b in buyers_by_product.items():
        # Never re-recommend something the customer already owns; repeat items
        # belong to the reorder channel, and duplicates would double-count.
        if pid in purchased or not buyers_b:
            continue
        p_b = len(buyers_b) / n_customers
        s = 0.0
        for a in purchased:
            buyers_a = buyers_by_product.get(a)
            if not buyers_a:
                continue
            co = len(buyers_a & buyers_b)
            if co:
                s += (co / len(buyers_a)) / p_b
        if s > 0:
            scores[pid] = s
    return scores


def _build_basket_stats(
    db: Session, business_id: int
) -> Tuple[Dict[int, Dict[int, int]], Dict[int, int], int]:
    """(co-purchase matrix, {product_id: baskets containing it}, n_baskets).

    A "basket" is a sale with at least one line item.
    """
    sale_items = (
        db.query(models.SaleItem.sale_id, models.SaleItem.product_id)
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
        .filter(models.Sale.business_id == business_id)
        .all()
    )

    sale_products: Dict[int, List[int]] = defaultdict(list)
    for sale_id, pid in sale_items:
        if pid:
            sale_products[sale_id].append(pid)

    matrix: Dict[int, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    basket_count: Dict[int, int] = defaultdict(int)
    for products in sale_products.values():
        unique = list(set(products))
        for p in unique:
            basket_count[p] += 1
        for i, a in enumerate(unique):
            for b in unique[i + 1:]:
                matrix[a][b] += 1
                matrix[b][a] += 1

    return matrix, basket_count, len(sale_products)


def _lift_scores(
    purchased: Dict[int, float],
    matrix: Dict[int, Dict[int, int]],
    basket_count: Dict[int, int],
    n_baskets: int,
) -> Dict[int, float]:
    """{candidate_id: summed lift} for products co-purchased with the customer's items.

    lift(a→b) = P(b in basket | basket has a) / P(b in basket).
    Lift ≈ 1 means "no special association" — exactly the popular-everywhere
    products that dominated the old raw-count ranking.
    """
    scores: Dict[int, float] = defaultdict(float)
    if n_baskets <= 0:
        return scores
    for pid in purchased:
        for other_id, together in matrix.get(pid, {}).items():
            if other_id in purchased:
                continue
            p_b = basket_count.get(other_id, 0) / n_baskets
            if p_b <= 0:
                continue
            p_b_given_a = together / max(basket_count.get(pid, 1), 1)
            scores[other_id] += p_b_given_a / p_b
    return scores


def _normalise(scores: Dict[int, float]) -> Dict[int, float]:
    """Scale scores to 0-1 (max-normalised) so channels can be blended."""
    if not scores:
        return {}
    top = max(scores.values())
    if top <= 0:
        return {}
    return {pid: s / top for pid, s in scores.items() if s > 0}


# ---------------------------------------------------------------------------
# Business-wide context — computed ONCE per request
# ---------------------------------------------------------------------------

@dataclass
class RecommendationContext:
    """Everything the engine needs that is business-wide rather than
    per-customer: popularity, the co-purchase matrix, reorder cadences and
    every customer's purchase/spend mix.

    WHY: ``get_all_recommendations_batch`` used to recompute all of this on
    every call. The API calls it once for the dashboard page AND once per
    customer in the leave-last-basket-out backtest, so a single page load ran
    these ~15 aggregations (including a full sale_items scan and a multi-
    hundred-parameter NOT IN) about a dozen times. Against remote Postgres
    that took over 30s and the dashboard failed with a client timeout. The
    business-wide work is now done once and sliced per customer.
    """

    pop: Dict[int, float]
    cat_map: Dict[int, str]
    cat_pop: Dict[str, Dict[int, float]]
    purchases: Dict[int, Dict[int, float]]
    cat_spend: Dict[int, Dict[str, float]]
    matrix: Dict[int, Dict[int, int]]
    basket_count: Dict[int, int]
    n_baskets: int
    last_dates: Dict[Tuple[int, int], dt.datetime]
    expected_gap: Dict[Tuple[int, int], float]
    newest: Optional[dt.datetime]
    buyers_by_product: Dict[int, set]
    n_customers: int
    product_info: Dict[int, dict]


def build_recommendation_context(
    db: Session, business_id: int, customer_ids: Optional[List[int]] = None
) -> RecommendationContext:
    """Run the business-wide aggregations once, for reuse across customers.

    ``customer_ids=None`` covers every customer of the business, so the
    resulting context can serve any page or backtest fold without another
    round trip.
    """
    pop = _popularity_scores(db, business_id)
    if not pop:
        pop = _popularity_from_sales(db, business_id)
    cat_map = _product_category_map(db, business_id)
    if customer_ids is None:
        customer_ids = [
            cid
            for (cid,) in db.query(models.Customer.id)
            .filter(models.Customer.business_id == business_id)
            .all()
        ]
    purchases = _purchased_product_ids_batch(db, business_id, customer_ids)
    cat_pop = _category_popularity(pop, cat_map)
    matrix, basket_count, n_baskets = _build_basket_stats(db, business_id)
    dates_by_cp = _purchase_dates_by_customer_product(db, business_id)
    expected_gap, last_dates, newest = _reorder_context(dates_by_cp)
    cat_spend = _category_spend_batch(db, business_id, customer_ids, cat_map)
    buyers_by_product, n_customers = _customer_product_pairs(db, business_id)
    product_info = _product_info_map(db, business_id)
    return RecommendationContext(
        pop=pop,
        cat_map=cat_map,
        cat_pop=cat_pop,
        purchases=purchases,
        cat_spend=cat_spend,
        matrix=matrix,
        basket_count=basket_count,
        n_baskets=n_baskets,
        last_dates=last_dates,
        expected_gap=expected_gap,
        newest=newest,
        buyers_by_product=buyers_by_product,
        n_customers=n_customers,
        product_info=product_info,
    )


# ---------------------------------------------------------------------------
# Public API — called from ai.py router
# ---------------------------------------------------------------------------

def train_recommendation_model(db: Session, business_id: int) -> Dict[str, Any]:
    """Rebuild the co-purchase matrix.  Returns summary stats."""
    matrix, _baskets, n_baskets = _build_basket_stats(db, business_id)
    n_products = len(matrix)
    n_pairs = sum(len(v) for v in matrix.values())
    return {
        "status": "trained",
        "business_id": business_id,
        "products_in_matrix": n_products,
        "co_purchase_pairs": n_pairs,
        "baskets": n_baskets,
        "message": f"Co-purchase matrix built with {n_pairs} product pairs across {n_products} products.",
    }


def get_all_recommendations_batch(
    db: Session, business_id: int, customer_ids: List[int], limit: int = 3,
    collect_signals: Dict[int, dict] = None,
    context: Optional[RecommendationContext] = None,
    avg_order_values: Optional[Dict[int, float]] = None,
) -> List[Tuple[int, List[Dict[str, Any]]]]:
    """Batch-optimised version for the /ai/recommendations endpoint.
    Fetches recommendations for multiple customers with minimal queries.

    When `collect_signals` is a dict it is filled with {customer_id: signal}
    from the engine (live channels, model-derived confidence, basis) so the
    API can expose honest per-customer match numbers.

    Pass a `context` (see ``build_recommendation_context``) to serve several
    calls -- a dashboard page plus every backtest fold -- from ONE round of
    business-wide aggregation. Without it the context is built here, which is
    correct but costs the full query set per call.

    `avg_order_values` maps customer id -> their average order value. It is
    used for the price-fit signal and the upsell/cross-sell labelling; when
    absent those are simply left at zero rather than guessed.
    """
    ctx = context if context is not None else build_recommendation_context(
        db, business_id, customer_ids
    )
    aov = avg_order_values or {}

    signals: Dict[int, dict] = {}
    results = []
    for cid in customer_ids:
        signal: dict = {}
        recs = _recommend_for_customer(
            db,
            purchased=ctx.purchases.get(cid, {}),
            matrix=ctx.matrix,
            basket_count=ctx.basket_count,
            n_baskets=ctx.n_baskets,
            cat_pop=ctx.cat_pop,
            cat_map=ctx.cat_map,
            pop=ctx.pop,
            limit=limit,
            cat_spend=ctx.cat_spend.get(cid, {}),
            last_dates=ctx.last_dates,
            expected_gap=ctx.expected_gap,
            reference=ctx.newest,
            customer_id=cid,
            buyers_by_product=ctx.buyers_by_product,
            n_customers=ctx.n_customers,
            signal_out=signal,
            avg_order_value=float(aov.get(cid, 0.0)),
            products=ctx.product_info,
        )
        signals[cid] = signal
        if collect_signals is not None:
            collect_signals[cid] = signal
        results.append((cid, recs))
    return results


def get_personalized_recommendations(
    db: Session,
    business_id: int,
    customer_id: int,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Recommend products for *customer_id* using multiple channels."""
    purchased = _purchased_product_ids(db, business_id, customer_id)
    pop = _popularity_scores(db, business_id)
    if not pop:
        pop = _popularity_from_sales(db, business_id)
    cat_map = _product_category_map(db, business_id)
    cat_pop = _category_popularity(pop, cat_map)
    matrix, basket_count, n_baskets = _build_basket_stats(db, business_id)
    dates_by_cp = _purchase_dates_by_customer_product(db, business_id)
    expected_gap, last_dates, newest = _reorder_context(dates_by_cp)
    cat_spend = _category_spend_batch(db, business_id, [customer_id], cat_map)
    buyers_by_product, n_buyers = _customer_product_pairs(db, business_id)

    return _recommend_for_customer(
        db,
        purchased=purchased,
        matrix=matrix,
        basket_count=basket_count,
        n_baskets=n_baskets,
        cat_pop=cat_pop,
        cat_map=cat_map,
        pop=pop,
        limit=limit,
        cat_spend=cat_spend.get(customer_id, {}),
        last_dates=last_dates,
        expected_gap=expected_gap,
        reference=newest,
        customer_id=customer_id,
        buyers_by_product=buyers_by_product,
        n_customers=n_buyers,
    )


def get_cross_sell_recommendations(
    db: Session,
    business_id: int,
    product_ids: List[int],
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Products frequently co-purchased with the given *product_ids*."""
    matrix, basket_count, n_baskets = _build_basket_stats(db, business_id)

    candidate_scores: Dict[int, float] = defaultdict(float)
    pid_set = set(product_ids)
    for pid in product_ids:
        for other_id, count in matrix.get(pid, {}).items():
            if other_id not in pid_set:
                candidate_scores[other_id] += count

    if candidate_scores:
        ranked = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        return _hydrate_products(db, ranked, "copurchase")

    # Fallback: popular products in same categories as the given products
    pop = _popularity_scores(db, business_id)
    if not pop:
        pop = _popularity_from_sales(db, business_id)
    cat_map = _product_category_map(db, business_id)
    cat_pop = _category_popularity(pop, cat_map)
    liked_cats = {cat_map.get(pid, "Uncategorized") for pid in product_ids}

    fallback_scores: Dict[int, float] = defaultdict(float)
    for cat in liked_cats:
        for pid, score in cat_pop.get(cat, {}).items():
            if pid not in pid_set:
                fallback_scores[pid] += score

    if fallback_scores:
        ranked = sorted(fallback_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        return _hydrate_products(db, ranked, "category")

    ranked_pop = sorted(pop.items(), key=lambda x: x[1], reverse=True)[:limit]
    return _hydrate_products(db, ranked_pop, "popularity")


# ---------------------------------------------------------------------------
# Core channel-blended recommendation logic
# ---------------------------------------------------------------------------

def _recommend_for_customer(
    db: Session,
    purchased: Dict[int, float],
    matrix: Dict,
    basket_count: Dict[int, int],
    n_baskets: int,
    cat_pop: Dict[str, Dict[int, float]],
    cat_map: Dict[int, str],
    pop: Dict[int, float],
    limit: int,
    cat_spend: Dict[str, float],
    last_dates: Dict[Tuple[int, int], dt.datetime],
    expected_gap: Dict[Tuple[int, int], float],
    reference: dt.datetime,
    customer_id: int,
    buyers_by_product: Dict[int, set] = None,
    n_customers: int = 0,
    signal_out: dict = None,
    avg_order_value: float = 0.0,
    products: Optional[Dict[int, dict]] = None,
) -> List[Dict[str, Any]]:
    """Blend per-customer channel scores and return the top `limit` products.

    Each channel is max-normalised to 0-1 before blending, so a product's
    final score reflects its standing across every channel that knows
    something about this customer. The per-item reason is the channel that
    contributed most to that item's score.

    When `signal_out` is a dict it is filled with the engine's REAL,
    deterministic per-customer signal (live channels, model-derived
    confidence, and a human-readable basis) so the UI can show honest
    match/confidence numbers instead of simulated ones.
    """
    channel_scores: Dict[str, Dict[int, float]] = {}

    def _emit(signal: Dict[str, Any]):
        if signal_out is not None:
            signal_out.clear()
            signal_out.update(signal)

    # Channel 1: co-purchase lift (needs multi-item baskets).
    n_lift_rules = 0
    if matrix and n_baskets > 0:
        lift = _lift_scores(purchased, matrix, basket_count, n_baskets)
        n_lift_rules = len(lift)
        lift = {pid: s for pid, s in lift.items() if s >= LIFT_MIN_SCORE}
        channel_scores["copurchase"] = _normalise(lift)

    # Channel 2: category affinity weighted by the customer's own spend mix.
    if purchased:
        total_spend = sum(cat_spend.values())
        liked_cats: Dict[str, float] = {}
        if total_spend > 0:
            for cat, amt in cat_spend.items():
                if amt > 0:
                    liked_cats[cat] = amt / total_spend
        else:
            for pid in purchased:
                cat = cat_map.get(pid, "Uncategorized")
                liked_cats[cat] = liked_cats.get(cat, 0.0) + 1.0
        cat_scores: Dict[int, float] = defaultdict(float)
        for cat, weight in liked_cats.items():
            for pid, score in cat_pop.get(cat, {}).items():
                if pid not in purchased:
                    cat_scores[pid] += weight * score
        channel_scores["category"] = _normalise(dict(cat_scores))

    # Channel 2b: "customers who bought X also bought Y" — user-based CF
    # conditioned on this customer's own products; separates customers whose
    # only shared trait used to be one broad category.
    if purchased and buyers_by_product and n_customers > 0:
        ab = _also_bought_scores(purchased, buyers_by_product, n_customers)
        channel_scores["alsobought"] = _normalise(ab)

    # Channel 3: reorder cycle — the customer's own repeat items, ranked by
    # how overdue each is AGAINST THAT ITEM'S OWN repurchase cadence (median
    # of the customer's inter-purchase gaps for it, falling back to the
    # product-wide and fleet cadences). Overdue-ness ratios are comparable
    # across items and customers, which a raw days-since ranking was not.
    repeat_items = {pid: q for pid, q in purchased.items() if q >= REORDER_MIN_QTY}
    if repeat_items and reference is not None:
        reorder_scores: Dict[int, float] = {}
        for pid in repeat_items:
            key = (customer_id, pid)
            last = last_dates.get(key)
            if last is None:
                continue
            days = _days_since(last, reference)
            exp = expected_gap.get(key, 14.0)
            # overdue ratio: 1.0 = exactly on their cycle; above = running late
            reorder_scores[pid] = days / exp
        channel_scores["reorder"] = _normalise(reorder_scores)

    # Blend normalised channels.
    blended: Dict[int, float] = defaultdict(float)
    dominant: Dict[int, str] = {}
    weights = {"copurchase": _W_COPURCHASE, "alsobought": _W_ALSOBOUGHT,
               "category": _W_CATEGORY, "reorder": _W_REORDER,
               "popularity": _W_POPULARITY}
    for channel, w in weights.items():
        scores = channel_scores.get(channel)
        if not scores:
            continue
        for pid, s in scores.items():
            blended[pid] += w * s
            if channel != "popularity" and (pid not in dominant or w * s > weights[dominant[pid]] * channel_scores.get(dominant[pid], {}).get(pid, 0)):
                dominant[pid] = channel

    ranked = sorted(blended.items(), key=lambda x: x[1], reverse=True)

    def _hydrate(ranked_items: List[Tuple], reason) -> List[Dict[str, Any]]:
        return _hydrate_products(db, ranked_items, reason, products=products)

    def _finalize(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Attach the per-item evidence the dashboard renders (0-1 match
        score, channel signals, recommendation type)."""
        return _decorate_items(
            items,
            channel_scores=channel_scores,
            pop=pop,
            avg_order_value=avg_order_value,
            dominant=dominant,
        )

    # ── Engine signal (REAL, deterministic — the anti-fabrication contract) ──
    # Everything the UI shows as a number comes from here, not Math.random().
    live_channels = [ch for ch in ("copurchase", "alsobought", "category", "reorder") if channel_scores.get(ch)]
    if ranked and live_channels:
        top_score = ranked[0][1]
        # Deterministic confidence: personalised channels (copurchase lift and
        # also-bought CF) are the strongest evidence, category/reorder add
        # support. Pure popularity output is explicitly NOT personalised.
        w = weights  # the blend weights above
        confidence = min(0.98, round(0.30 * bool(channel_scores.get("copurchase")) + 0.30 * bool(channel_scores.get("alsobought")) + 0.15 * bool(channel_scores.get("category")) + 0.10 * bool(channel_scores.get("reorder")) + 0.13 * (1 if top_score >= 1.0 else top_score / 1.0), 2))
        basis = (w["copurchase"] if channel_scores.get("copurchase") else 0) + (w["alsobought"] if channel_scores.get("alsobought") else 0) + (w["category"] if channel_scores.get("category") else 0) + (w["reorder"] if channel_scores.get("reorder") else 0)
        basis = min(1.0, basis / 5.7)
        n_fallback_rules = 0
    else:
        top_score = 0.0
        confidence = 0.25
        basis = 0.0
        live_channels = ["popularity"]
        n_fallback_rules = 1 if (purchased or customer_id is not None) else 0
    if signal_out is not None:
        _emit({
            "channels": live_channels,
            "n_rules": n_lift_rules if (ranked and live_channels and "copurchase" in live_channels) else n_fallback_rules,
            "confidence": confidence,
            "basis": round(basis, 2),
            "n_purchased": len(purchased),
        })

    # Only customers with NO personalised signal at all (no purchase history,
    # or no live channel) fall through to the shared popularity list. NOTE:
    # the reorder channel intentionally recommends items the customer already
    # buys, so "already purchased" must never disqualify a blended ranking --
    # that guard is what once made every big-spender see the same top sellers.
    if not ranked:
        # Customers with SOME history but no live channel (e.g. a single
        # purchase) get a personalised, per-customer seed that rotates the
        # business's catalogue deterministically by customer id. Without it,
        # every such customer saw the IDENTICAL global best-seller list.
        if purchased or customer_id is not None:
            candidates = [
                (pid, sc)
                for pid, sc in sorted(pop.items(), key=lambda x: x[1], reverse=True)
                if pid not in purchased
            ]
            if candidates:
                # Rotate by the customer's id + last purchase recency signal:
                # customer A starts at rank 0, customer B at rank 1, etc., so
                # two customers never get the same top-3.
                rotation = (customer_id or 0) % len(candidates)
                rotated = candidates[rotation:] + candidates[:rotation]
                return _finalize(_hydrate(rotated[:limit], "popularity"))
            ranked_all = sorted(pop.items(), key=lambda x: x[1], reverse=True)[:limit]
            return _finalize(_hydrate(ranked_all, "reorder"))
        # True cold start (no purchases at all): global best-sellers.
        ranked_pop = [
            (pid, sc)
            for pid, sc in sorted(pop.items(), key=lambda x: x[1], reverse=True)
            if pid not in purchased
        ][:limit]
        if ranked_pop:
            return _finalize(_hydrate(ranked_pop, "popularity"))
        ranked_all = sorted(pop.items(), key=lambda x: x[1], reverse=True)[:limit]
        return _finalize(_hydrate(ranked_all, "reorder"))

    top = ranked[:limit]
    return _finalize(
        _hydrate(top, {pid: dominant.get(pid, "category") for pid, _ in top})
    )


def _days_since(d: dt.datetime, ref: dt.datetime) -> float:
    """Whole days between d and ref."""
    delta = ref - d
    return max(delta.days, 0)


def recommendation_reason(reason_key: str) -> str:
    return {
        "copurchase": "Frequently bought together with items this customer already purchases.",
        "alsobought": "Customers with similar buying habits also purchase this.",
        "category": "Matches the categories this customer buys from most.",
        "reorder": "A repeat item this customer may be ready to buy again.",
        "popularity": "A best-seller this customer has not tried yet.",
    }.get(reason_key, "Based on purchase history and similar customers.")


# Maps the channel that drove a pick onto the label the dashboard groups by.
_TYPE_BY_CHANNEL = {
    "copurchase": "cross_sell",
    "alsobought": "personalized",
    "category": "personalized",
    "reorder": "personalized",
    "popularity": "popular",
}


def _decorate_items(
    items: List[Dict[str, Any]],
    channel_scores: Dict[str, Dict[int, float]],
    pop: Dict[int, float],
    avg_order_value: float,
    dominant: Dict[int, str],
) -> List[Dict[str, Any]]:
    """Add the per-item fields the dashboard renders, all from real engine
    state or real catalogue/customer data — never simulated:

      score            blended score rescaled so the customer's best pick is
                       1.0 (the UI draws it as a 0-100% match ring, so a raw
                       blended score like 1.5 would clamp to an unreadable 100%)
      signals          the engine's own channel scores for THIS item, plus the
                       item's share of the business's sales (popularity) and
                       how close its price sits to the customer's average order
                       value (price fit)
      recommendation_type  the dominant channel as cross-sell / upsell /
                       personalized / popular, where a personalised pick priced
                       above the customer's usual order is an upsell
      inventory_available  real stock on hand, so the card can flag out-of-stock
    """
    if not items:
        return items
    raw_top = max((float(i.get("raw_score") or 0.0) for i in items), default=0.0)
    pop_top = max(pop.values()) if pop else 0.0

    for it in items:
        pid = it["product_id"]
        raw = float(it.get("raw_score") or 0.0)
        it["score"] = round(min(raw / raw_top, 1.0), 4) if raw_top > 0 else 0.0
        it["match_pct"] = round(100.0 * it["score"])

        price = float(it.get("price") or 0.0)
        if avg_order_value > 0 and price > 0:
            price_fit = max(
                0.0, 1.0 - abs(price - avg_order_value) / max(price, avg_order_value)
            )
        else:
            price_fit = 0.0
        # ALL FOUR engine channels are reported, not just the two that happen
        # to need multi-item baskets. Reporting only copurchase/also-bought
        # left a reorder- or category-driven pick with two 0% rows and no way
        # to see what actually drove it -- the breakdown then credited the
        # strongest REMAINING signal, contradicting the card's own label.
        it["signals"] = {
            "collaborative_score": round(channel_scores.get("alsobought", {}).get(pid, 0.0), 3),
            "association_score": round(channel_scores.get("copurchase", {}).get(pid, 0.0), 3),
            "category_score": round(channel_scores.get("category", {}).get(pid, 0.0), 3),
            "reorder_score": round(channel_scores.get("reorder", {}).get(pid, 0.0), 3),
            "popularity_score": round(pop.get(pid, 0.0) / pop_top, 3) if pop_top else 0.0,
            "price_score": round(price_fit, 3),
        }

        channel = dominant.get(pid)
        if channel is None:
            # No blended driver recorded -- these are the popularity-rotation
            # fallback picks. Name the strongest channel that actually scored
            # this item instead of guessing "category", so the reported driver
            # always matches a non-zero signal the UI can display.
            channel = next(
                (
                    cand
                    for cand in ("copurchase", "alsobought", "reorder", "category")
                    if channel_scores.get(cand, {}).get(pid, 0.0) > 0
                ),
                "popularity",
            )
        rtype = _TYPE_BY_CHANNEL.get(channel, "personalized")
        if rtype == "personalized" and avg_order_value > 0 and price > avg_order_value:
            rtype = "upsell"
        it["recommendation_type"] = rtype
        # The channel that actually drove the pick. The four signal scores are
        # the dashboard's vocabulary and cannot express a reorder or category
        # pick, so without this the UI labelled a repeat purchase "Popular
        # choice" while the engine's own reason said "a repeat item".
        it["dominant_channel"] = channel
    return items


def _hydrate_products(
    db: Session,
    ranked: List[Tuple],
    reason: Union[str, Dict[int, str]] = "copurchase",
    products: Optional[Dict[int, dict]] = None,
) -> List[Dict[str, Any]]:
    """Convert [(product_id, score)] → [{name, price, score, reason, …}].

    `products` is the pre-fetched {id: {name, price, …}} map from the
    recommendation context. Only a caller that has no context (the
    single-customer endpoint) falls back to a query here.
    """
    if not ranked:
        return []
    ids = [pid for pid, _ in ranked]
    if products is None:
        products = {
            p.id: {
                "name": p.name,
                "price": p.price,
                "category": p.category,
                "stock_quantity": p.stock_quantity,
            }
            for p in db.query(models.Product).filter(models.Product.id.in_(ids)).all()
        }
    out = []
    for pid, sc in ranked:
        info = products.get(pid)
        if info is None:
            continue
        key = reason.get(pid, "category") if isinstance(reason, dict) else reason
        out.append(
            {
                "product_id": pid,
                "product_name": info["name"],  # the dashboard's field name
                "name": info["name"],
                "price": info["price"],
                "category": info["category"],
                "inventory_available": info["stock_quantity"],
                "score": round(sc, 2),
                "raw_score": round(float(sc), 4),
                "reason": recommendation_reason(key),
            }
        )
    return out
