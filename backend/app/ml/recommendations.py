"""Product recommendation engine.

Strategy (in priority order):
  1. Co-purchase / market-basket analysis (products bought together).
  2. Category-based similarity (popular items in categories the customer likes).
  3. Pure popularity fallback (most-sold products not yet purchased).

All functions are stateless — computed on the fly from current sales data.
Optimised to minimise round-trips to remote Postgres (Neon).
"""

from collections import defaultdict
from typing import Any, Dict, List

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from .. import models


# ---------------------------------------------------------------------------
# Internal helpers — batched for performance
# ---------------------------------------------------------------------------

def _popularity_scores(db: Session, business_id: int) -> Dict[int, float]:
    """Return {product_id: popularity_score} based on total quantity sold."""
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


def _product_category_map(db: Session, business_id: int) -> Dict[int, str]:
    """Return {product_id: category} for all products in the business (1 query)."""
    rows = (
        db.query(models.Product.id, models.Product.category)
        .filter(models.Product.business_id == business_id)
        .all()
    )
    return {pid: (cat or "Uncategorized") for pid, cat in rows}


def _category_popularity(
    db: Session, business_id: int, pop: Dict[int, float], cat_map: Dict[int, str]
) -> Dict[str, Dict[int, float]]:
    """Return {category: {product_id: score}} — built from pre-fetched data, no extra queries."""
    result: Dict[str, Dict[int, float]] = defaultdict(dict)
    for pid, score in pop.items():
        cat = cat_map.get(pid, "Uncategorized")
        result[cat][pid] = score
    return result


def _purchased_product_ids_batch(
    db: Session, business_id: int, customer_ids: List[int]
) -> Dict[int, set]:
    """Return {customer_id: {product_id, ...}} for all customers in one query."""
    if not customer_ids:
        return {}
    rows = (
        db.query(models.Sale.customer_id, models.SaleItem.product_id)
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id.in_(customer_ids),
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    result: Dict[int, set] = defaultdict(set)
    for cid, pid in rows:
        result[cid].add(pid)
    return dict(result)


def _purchased_product_ids(
    db: Session, business_id: int, customer_id: int
) -> set:
    """Return the set of product IDs a customer has already purchased (single customer)."""
    rows = (
        db.query(models.SaleItem.product_id)
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
        .filter(
            models.Sale.business_id == business_id,
            models.Sale.customer_id == customer_id,
            models.SaleItem.product_id.isnot(None),
        )
        .all()
    )
    return {pid for (pid,) in rows}


# ---------------------------------------------------------------------------
# Public API — called from ai.py router
# ---------------------------------------------------------------------------

def train_recommendation_model(db: Session, business_id: int) -> Dict[str, Any]:
    """Rebuild the co-purchase matrix.  Returns summary stats."""
    matrix = _build_co_purchase_matrix(db, business_id)
    n_products = len(matrix)
    n_pairs = sum(len(v) for v in matrix.values())
    return {
        "status": "trained",
        "business_id": business_id,
        "products_in_matrix": n_products,
        "co_purchase_pairs": n_pairs,
        "message": f"Co-purchase matrix built with {n_pairs} product pairs across {n_products} products.",
    }


def get_all_recommendations_batch(
    db: Session, business_id: int, customer_ids: List[int], limit: int = 3
) -> List[Dict[str, Any]]:
    """Batch-optimised version for the /ai/recommendations endpoint.
    Fetches recommendations for multiple customers with minimal queries.
    """
    # 1 query each for popularity, categories, and all purchases
    pop = _popularity_scores(db, business_id)
    cat_map = _product_category_map(db, business_id)
    purchases = _purchased_product_ids_batch(db, business_id, customer_ids)
    cat_pop = _category_popularity(db, business_id, pop, cat_map)

    # Optionally try co-purchase (1 query)
    matrix = _build_co_purchase_matrix(db, business_id)

    results = []
    for cid in customer_ids:
        purchased = purchases.get(cid, set())
        recs = _recommend_for_customer(
            db, business_id, cid, purchased, matrix, cat_pop, cat_map, pop, limit
        )
        results.append((cid, recs))
    return results


def get_personalized_recommendations(
    db: Session,
    business_id: int,
    customer_id: int,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Recommend products for *customer_id* using multiple strategies."""
    purchased = _purchased_product_ids(db, business_id, customer_id)

    pop = _popularity_scores(db, business_id)
    cat_map = _product_category_map(db, business_id)
    cat_pop = _category_popularity(db, business_id, pop, cat_map)
    matrix = _build_co_purchase_matrix(db, business_id)

    return _recommend_for_customer(
        db, business_id, customer_id, purchased, matrix, cat_pop, cat_map, pop, limit
    )


def _recommend_for_customer(
    db: Session,
    business_id: int,
    customer_id: int,
    purchased: set,
    matrix: Dict,
    cat_pop: Dict[str, Dict[int, float]],
    cat_map: Dict[int, str],
    pop: Dict[int, float],
    limit: int,
) -> List[Dict[str, Any]]:
    """Core recommendation logic shared by single and batch endpoints."""

    # Strategy 1: Co-purchase matrix
    if matrix:
        candidate_scores: Dict[int, float] = defaultdict(float)
        for pid in purchased:
            for other_id, count in matrix.get(pid, {}).items():
                if other_id not in purchased:
                    candidate_scores[other_id] += count
        if candidate_scores:
            ranked = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
            return _hydrate_products(db, ranked)

    # Strategy 2: Category-based — suggest popular items from categories
    # the customer has bought from (but not products they already own)
    if purchased:
        liked_cats = {cat_map.get(pid, "Uncategorized") for pid in purchased}
        candidate_scores: Dict[int, float] = defaultdict(float)
        for cat in liked_cats:
            for pid, score in cat_pop.get(cat, {}).items():
                if pid not in purchased:
                    candidate_scores[pid] += score
        if candidate_scores:
            ranked = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
            return _hydrate_products(db, ranked)

    # Strategy 3: Pure popularity — top-selling items not yet purchased
    ranked_pop = [
        (pid, sc)
        for pid, sc in sorted(pop.items(), key=lambda x: x[1], reverse=True)
        if pid not in purchased
    ][:limit]
    if ranked_pop:
        return _hydrate_products(db, ranked_pop)

    # If customer bought everything, show top sellers as "reorder suggestions"
    ranked_all = sorted(pop.items(), key=lambda x: x[1], reverse=True)[:limit]
    return _hydrate_products(db, ranked_all)


def get_cross_sell_recommendations(
    db: Session,
    business_id: int,
    product_ids: List[int],
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Products frequently co-purchased with the given *product_ids*."""
    matrix = _build_co_purchase_matrix(db, business_id)

    candidate_scores: Dict[int, float] = defaultdict(float)
    pid_set = set(product_ids)
    for pid in product_ids:
        for other_id, count in matrix.get(pid, {}).items():
            if other_id not in pid_set:
                candidate_scores[other_id] += count

    if candidate_scores:
        ranked = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        return _hydrate_products(db, ranked)

    # Fallback: popular products in same categories as the given products
    pop = _popularity_scores(db, business_id)
    cat_map = _product_category_map(db, business_id)
    liked_cats = {cat_map.get(pid, "Uncategorized") for pid in product_ids}

    fallback_scores: Dict[int, float] = defaultdict(float)
    for cat in liked_cats:
        for pid, score in cat_pop.get(cat, {}).items():
            if pid not in pid_set:
                fallback_scores[pid] += score

    if fallback_scores:
        ranked = sorted(fallback_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        return _hydrate_products(db, ranked)

    ranked_pop = sorted(pop.items(), key=lambda x: x[1], reverse=True)[:limit]
    return _hydrate_products(db, ranked_pop)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _build_co_purchase_matrix(db: Session, business_id: int):
    """Build {product_a: {product_b: count}} from sales that share items."""
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
    for products in sale_products.values():
        unique = list(set(products))
        for i, a in enumerate(unique):
            for b in unique[i + 1 :]:
                matrix[a][b] += 1
                matrix[b][a] += 1

    return matrix


def _hydrate_products(
    db: Session, ranked: List[tuple]
) -> List[Dict[str, Any]]:
    """Convert [(product_id, score)] → [{name, price, score, …}]."""
    if not ranked:
        return []
    ids = [pid for pid, _ in ranked]
    products = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(ids)).all()}
    return [
        {
            "product_id": pid,
            "name": products[pid].name if pid in products else f"Product #{pid}",
            "price": products[pid].price if pid in products else 0,
            "category": products[pid].category if pid in products else "",
            "score": round(sc, 2),
        }
        for pid, sc in ranked
        if pid in products
    ]
