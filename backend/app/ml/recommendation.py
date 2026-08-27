"""
Product Recommendation Engine
==============================

Item-item collaborative filtering built from actual sale_items purchase
history, with budget-aware filtering (never recommend a product far outside
a customer's typical order value) and a popularity fallback for customers
with little/no purchase history (cold start).

Mirrors the style of ml/segmentation.py: a build_* function to assemble
features from the DB, a train/compute function, and a top-level function
the router calls that returns plain dict/list data ready for JSON.
"""

from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


# Budget-aware filtering bounds, as fractions of the customer's average
# order value (avg_order_value = total_spent / total_orders).
BUDGET_LOWER_MULTIPLIER = 0.3
BUDGET_UPPER_MULTIPLIER = 1.6

TOP_N_RECOMMENDATIONS = 2
MIN_ITEMS_FOR_COLLAB = 2  # customer needs >=2 distinct products purchased


def build_purchase_matrix(db):
    """
    Build a customer x product matrix of total quantity purchased,
    from actual sale_items / sales data.
    """
    from .. import models

    sale_items = (
        db.query(models.SaleItem, models.Sale.customer_id)
        .join(models.Sale, models.SaleItem.sale_id == models.Sale.id)
        .filter(models.Sale.customer_id.isnot(None))
        .all()
    )

    rows = []
    for item, customer_id in sale_items:
        rows.append(
            {
                "customer_id": customer_id,
                "product_id": item.product_id,
                "quantity": item.quantity or 0,
            }
        )

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df = df[df["product_id"].notna()]

    if df.empty:
        return pd.DataFrame()

    matrix = (
        df.groupby(["customer_id", "product_id"])["quantity"]
        .sum()
        .unstack(fill_value=0)
    )
    return matrix


def compute_item_similarity(matrix: pd.DataFrame) -> pd.DataFrame:
    """Item-item cosine similarity from the customer x product matrix."""
    if matrix.empty or matrix.shape[1] < 2:
        return pd.DataFrame()

    sim = cosine_similarity(matrix.T.values)
    return pd.DataFrame(sim, index=matrix.columns, columns=matrix.columns)


def collaborative_candidates(customer_id, matrix, similarity, n=10) -> pd.Series:
    """Score candidate products for a customer using item-item similarity
    against what they've already purchased."""
    if matrix.empty or similarity.empty or customer_id not in matrix.index:
        return pd.Series(dtype=float)

    user_row = matrix.loc[customer_id]
    purchased = user_row[user_row > 0].index

    if len(purchased) < MIN_ITEMS_FOR_COLLAB:
        return pd.Series(dtype=float)

    scores = similarity[purchased].sum(axis=1)
    scores = scores.drop(index=purchased, errors="ignore")
    return scores.sort_values(ascending=False).head(n)


def popularity_candidates(matrix: pd.DataFrame, n=10) -> pd.Series:
    """Fallback for cold-start customers: overall best-selling products."""
    if matrix.empty:
        return pd.Series(dtype=float)
    popularity = matrix.sum(axis=0)
    return popularity.sort_values(ascending=False).head(n)


def apply_budget_filter(candidates: pd.Series, avg_order_value, products_by_id) -> pd.Series:
    """Keep only products priced within a reasonable band of what this
    customer typically spends per order."""
    if candidates.empty or not avg_order_value or avg_order_value <= 0:
        return candidates

    lo = avg_order_value * BUDGET_LOWER_MULTIPLIER
    hi = avg_order_value * BUDGET_UPPER_MULTIPLIER

    valid_ids = [
        pid
        for pid in candidates.index
        if pid in products_by_id
        and lo <= (products_by_id[pid].selling_price or 0) <= hi
    ]
    return candidates.loc[valid_ids]


def build_reason(is_collab: bool, is_budget_filtered: bool) -> str:
    if is_collab and is_budget_filtered:
        return "Based on purchases by customers with similar buying patterns, matched to this customer's typical order value."
    if is_collab:
        return "Based on frequent co-purchases by similar customers in their demographic."
    return "Popular product recommended based on overall best-sellers (limited purchase history for this customer)."


def generate_product_recommendations(db):
    """
    Top-level entry point called by the router. Returns
    {"rows": [{customer_id, customer_name, recommended_products, reason}, ...]}
    matching the existing frontend contract exactly.
    """
    from .. import models

    customers = db.query(models.Customer).all()
    products = db.query(models.Product).filter(models.Product.is_active.is_(True)).all()

    if not customers or not products:
        return {"rows": []}

    products_by_id = {p.id: p for p in products}

    matrix = build_purchase_matrix(db)
    similarity = compute_item_similarity(matrix)
    popularity_fallback = popularity_candidates(matrix, n=10)

    rows = []

    for c in customers:
        avg_order_value = (
            (c.total_spent / c.total_orders)
            if c.total_orders and c.total_orders > 0
            else None
        )

        candidates = collaborative_candidates(c.id, matrix, similarity, n=10)
        used_collab = not candidates.empty

        if candidates.empty:
            candidates = popularity_fallback

        if candidates.empty:
            # No purchase history anywhere yet (e.g. brand new business data)
            continue

        filtered = apply_budget_filter(candidates, avg_order_value, products_by_id)
        used_budget_filter = len(filtered) > 0 and len(filtered) < len(candidates)

        # If budget filtering removed everything, fall back to unfiltered
        # candidates rather than showing nothing for this customer.
        final = filtered if not filtered.empty else candidates
        top_ids = final.head(TOP_N_RECOMMENDATIONS).index.tolist()

        recommended_names = [
            products_by_id[pid].name for pid in top_ids if pid in products_by_id
        ]

        if not recommended_names:
            continue

        rows.append(
            {
                "customer_id": c.id,
                "customer_name": c.full_name,
                "recommended_products": recommended_names,
                "reason": build_reason(used_collab, used_budget_filter),
            }
        )

    return {"rows": rows}