
"""
MarketMind AI - Production Recommendation Engine (v3 — correctness + perf fixes)
==================================================================================

Fixes two real issues found in the previous version:

BUG FIX — price-band filter was silently disabled
----------------------------------------------------------------------
The previous rewrite only enforced the hard price-compatibility band
when a candidate had NO signal sources at all:

    if not (lo <= price <= hi) and not sources:
        continue

But `sources` is populated whenever popularity > 0, which is true for
almost every product in the catalog. So the filter essentially never
fired, and cheap globally-popular junk (₹1 ceramic jars) could rank
for customers with a ₹3,788 average order value. The original
(unoptimized) code enforced this band unconditionally whenever AOV was
known — that's restored below, with no escape hatch.

PERF FIX — single-customer requests no longer pay for the whole customer base
----------------------------------------------------------------------
Two separate costs were being conflated:

  (a) Catalog-wide matrices (item similarity, product association) —
      these depend only on the product catalog + sales history, NOT on
      which customer you're asking about. They're expensive (products x
      products) but only need to be built when the underlying sales
      data actually changes. Now cached with a TTL, like segmentation.py
      caches its trained model with joblib.

  (b) Per-customer scoring — computing collaborative/association scores
      for EVERY customer via one big (customers x products) batch
      multiply, even when only one customer was requested. Now:
      customer_id given -> compute just that customer's score row
      (O(products)), not the full batch (O(customers x products)).
      customer_id=None (dashboard/all-customers view) -> batch path,
      same as before, since you need everyone anyway.
"""

import time
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


# ============================================================
# CONFIGURATION
# ============================================================

TOP_N_RECOMMENDATIONS = 5
MIN_ITEMS_FOR_COLLAB = 2

COLLAB_WEIGHT = 0.35
ASSOCIATION_WEIGHT = 0.30
POPULARITY_WEIGHT = 0.15
PRICE_WEIGHT = 0.10

MIN_PRICE_MULTIPLIER = 0.30
MAX_PRICE_MULTIPLIER = 1.80

MIN_SUPPORT = 0.01
MIN_CONFIDENCE = 0.05

REORDER_MIN_PURCHASES = 2
MIN_RECOMMENDABLE_STOCK = 1

# How long the catalog-wide matrices stay valid before being rebuilt.
# Sales data doesn't change every second, so 5 minutes is a reasonable
# default for a small-biz dashboard — tune as needed.
MATRIX_CACHE_TTL_SECONDS = 300


# ============================================================
# CATALOG-WIDE MATRIX CACHE
# ============================================================
# Module-level cache: rebuilding the association/similarity matrices
# is the expensive, catalog-scale operation. It should happen once per
# TTL window, not once per HTTP request.

_matrix_cache = {
    "computed_at": 0.0,
    "matrix": None,
    "similarity": None,
    "association_matrix": None,
    "popularity": None,
}


def _cache_is_fresh():
    return (time.time() - _matrix_cache["computed_at"]) < MATRIX_CACHE_TTL_SECONDS and _matrix_cache["matrix"] is not None


def invalidate_matrix_cache():
    """Call this after a bulk sales import, or wire it to run on a
    schedule if you want tighter freshness than the TTL."""
    _matrix_cache["computed_at"] = 0.0


def get_catalog_matrices(db, force_refresh=False):
    """
    Returns (matrix, similarity, association_matrix, popularity),
    rebuilding only if the cache is stale or force_refresh is set.
    This is the piece that used to run on every single request.
    """
    if not force_refresh and _cache_is_fresh():
        return (
            _matrix_cache["matrix"],
            _matrix_cache["similarity"],
            _matrix_cache["association_matrix"],
            _matrix_cache["popularity"],
        )

    sales_df = build_sales_dataframe(db)
    matrix = build_purchase_matrix_from_df(sales_df)
    similarity = compute_item_similarity(matrix)
    association_matrix = compute_association_matrix(matrix)
    popularity = popularity_vector(matrix)

    _matrix_cache.update(
        {
            "computed_at": time.time(),
            "matrix": matrix,
            "similarity": similarity,
            "association_matrix": association_matrix,
            "popularity": popularity,
        }
    )
    return matrix, similarity, association_matrix, popularity


# ============================================================
# DATABASE HELPERS
# ============================================================

def build_product_catalog(db):
    from .. import models

    products = db.query(models.Product).filter(models.Product.is_active.is_(True)).all()
    return {product.id: product for product in products}


def build_inventory_map(db):
    from .. import models

    rows = db.query(models.Inventory.product_id, models.Inventory.quantity_available).all()
    inventory = defaultdict(int)
    for product_id, quantity in rows:
        if product_id is not None:
            inventory[product_id] += int(quantity or 0)
    return dict(inventory)


def build_sales_dataframe(db):
    from .. import models

    rows = (
        db.query(
            models.Sale.id.label("sale_id"),
            models.Sale.customer_id,
            models.Sale.sale_date,
            models.SaleItem.product_id,
            models.SaleItem.quantity,
            models.Product.selling_price,
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .join(models.Product, models.Product.id == models.SaleItem.product_id)
        .filter(models.Sale.customer_id.isnot(None), models.SaleItem.product_id.isnot(None))
        .all()
    )
    if not rows:
        return pd.DataFrame()

    data = pd.DataFrame(
        rows, columns=["sale_id", "customer_id", "sale_date", "product_id", "quantity", "selling_price"]
    )
    data["quantity"] = data["quantity"].fillna(0)
    data["selling_price"] = data["selling_price"].fillna(0).astype(float)
    data["line_value"] = data["quantity"] * data["selling_price"]
    return data


def build_customer_sales_dataframe(db, customer_id):
    """Lightweight, single-customer version of build_sales_dataframe —
    used by the single-customer fast path so we don't pull the whole
    business's sales history just to compute one person's AOV/recency."""
    from .. import models

    rows = (
        db.query(
            models.Sale.id.label("sale_id"),
            models.Sale.sale_date,
            models.SaleItem.product_id,
            models.SaleItem.quantity,
            models.Product.selling_price,
        )
        .join(models.SaleItem, models.SaleItem.sale_id == models.Sale.id)
        .join(models.Product, models.Product.id == models.SaleItem.product_id)
        .filter(models.Sale.customer_id == customer_id, models.SaleItem.product_id.isnot(None))
        .all()
    )
    if not rows:
        return pd.DataFrame()

    data = pd.DataFrame(rows, columns=["sale_id", "sale_date", "product_id", "quantity", "selling_price"])
    data["quantity"] = data["quantity"].fillna(0)
    data["selling_price"] = data["selling_price"].fillna(0).astype(float)
    data["line_value"] = data["quantity"] * data["selling_price"]
    data["customer_id"] = customer_id
    return data


def _profile_from_sales(sales_df):
    """Shared by both the batch and single-customer paths."""
    if sales_df.empty:
        return {"total_orders": 0, "total_spent": 0.0, "average_order_value": None, "recency_days": None}

    orders = sales_df.groupby("sale_id")
    order_values = orders["line_value"].sum()
    total_orders = len(order_values)
    total_spent = float(order_values.sum())
    average_order_value = total_spent / total_orders if total_orders > 0 else None

    purchase_dates = sorted(pd.to_datetime(sales_df["sale_date"]).dropna().unique())
    recency_days = max(0, (pd.Timestamp.now() - pd.Timestamp(purchase_dates[-1])).days) if purchase_dates else None

    return {
        "total_orders": total_orders,
        "total_spent": round(total_spent, 2),
        "average_order_value": round(average_order_value, 2) if average_order_value is not None else None,
        "recency_days": recency_days,
    }


def build_customer_profiles(sales_df):
    if sales_df.empty:
        return {}
    return {cid: _profile_from_sales(group) for cid, group in sales_df.groupby("customer_id")}


def build_customer_product_sets(sales_df):
    if sales_df.empty:
        return {}
    customer_products = defaultdict(set)
    for customer_id, product_id in sales_df[["customer_id", "product_id"]].itertuples(index=False):
        customer_products[customer_id].add(product_id)
    return dict(customer_products)


def build_purchase_matrix_from_df(sales_df):
    if sales_df.empty:
        return pd.DataFrame()
    return sales_df.groupby(["customer_id", "product_id"])["quantity"].sum().unstack(fill_value=0)


# ============================================================
# CATALOG-WIDE SCORING (unchanged math, cached by get_catalog_matrices)
# ============================================================

def compute_item_similarity(matrix):
    if matrix.empty or matrix.shape[1] < 2:
        return pd.DataFrame()
    similarity = cosine_similarity(matrix.T.values)
    return pd.DataFrame(similarity, index=matrix.columns, columns=matrix.columns)


def compute_association_matrix(matrix, min_support=MIN_SUPPORT, min_confidence=MIN_CONFIDENCE):
    if matrix.empty or matrix.shape[1] < 2:
        return pd.DataFrame()

    binary = (matrix.values > 0).astype(np.float64)
    total_customers = binary.shape[0]
    if total_customers == 0:
        return pd.DataFrame()

    cooccurrence = binary.T @ binary
    product_counts = np.diag(cooccurrence).copy()
    product_counts[product_counts == 0] = np.nan

    with np.errstate(divide="ignore", invalid="ignore"):
        support = cooccurrence / total_customers
        confidence = cooccurrence / product_counts[:, None]
        candidate_support = product_counts / total_customers
        lift = confidence / candidate_support[None, :]

    support = np.nan_to_num(support, nan=0.0)
    confidence = np.nan_to_num(confidence, nan=0.0)
    lift = np.nan_to_num(lift, nan=0.0, posinf=0.0)

    np.fill_diagonal(support, 0.0)
    np.fill_diagonal(confidence, 0.0)
    np.fill_diagonal(lift, 0.0)

    lift_capped = np.clip(lift, 0.0, 10.0)
    score = confidence * 0.6 + (lift_capped / 10.0) * 0.4
    mask = (support < min_support) | (confidence < min_confidence)
    score = np.where(mask, 0.0, score)

    return pd.DataFrame(score, index=matrix.columns, columns=matrix.columns)


def popularity_vector(matrix):
    if matrix.empty:
        return pd.Series(dtype=float)
    popularity = matrix.sum(axis=0)
    maximum = popularity.max()
    if maximum > 0:
        popularity = popularity / maximum
    return popularity


# ============================================================
# PRICE / CLASSIFICATION / EXPLANATION (unchanged)
# ============================================================

def calculate_price_score(product_price, average_order_value):
    if not average_order_value or average_order_value <= 0 or product_price is None or product_price <= 0:
        return 0.5
    ratio = product_price / average_order_value
    if ratio < MIN_PRICE_MULTIPLIER:
        return 0.35
    if ratio > MAX_PRICE_MULTIPLIER:
        return 0.10
    distance = abs(np.log(ratio))
    return float(max(0.0, 1.0 - min(distance / 1.5, 1.0)))


def classify_recommendation_type(product, average_order_value):
    price = float(product.selling_price or 0)
    if not average_order_value or average_order_value <= 0:
        return "cross_sell"
    return "upsell" if price >= average_order_value * 1.10 else "cross_sell"


def build_explanation(sources, recommendation_type):
    if "collaborative" in sources and "association" in sources:
        reason = "Customers with similar purchasing patterns also frequently buy this product."
    elif "collaborative" in sources:
        reason = "Recommended from purchasing patterns of customers with similar product preferences."
    elif "association" in sources:
        reason = "Frequently purchased together with products already in this customer's purchase history."
    elif "popularity" in sources:
        reason = "A popular product that is currently available and relevant to this customer's purchasing profile."
    else:
        reason = "Selected as a relevant product for this customer's purchasing profile."
    if recommendation_type == "upsell":
        reason += " It also represents an upsell opportunity above the customer's typical order value."
    return reason


def build_reorder_candidates(sales_df):
    if sales_df.empty:
        return {}
    counts = sales_df.groupby("product_id")["sale_id"].nunique()
    return {int(pid): int(c) for pid, c in counts.items() if c >= REORDER_MIN_PURCHASES}


# ============================================================
# SHARED CANDIDATE RANKING — used by both single-customer and batch paths
# ============================================================

def _rank_candidates_for_customer(
    purchased,
    collab_row,
    assoc_row,
    popularity,
    products_by_id,
    inventory_map,
    average_order_value,
    matrix_products,
    top_n,
):
    purchased_count = len(purchased)
    if purchased_count >= 5:
        w_collab, w_assoc, w_pop = COLLAB_WEIGHT * 1.10, ASSOCIATION_WEIGHT * 1.05, POPULARITY_WEIGHT * 0.50
    elif purchased_count >= 2:
        w_collab, w_assoc, w_pop = COLLAB_WEIGHT, ASSOCIATION_WEIGHT, POPULARITY_WEIGHT
    else:
        w_collab, w_assoc, w_pop = COLLAB_WEIGHT * 0.50, ASSOCIATION_WEIGHT * 0.50, POPULARITY_WEIGHT * 2.0

    has_aov = bool(average_order_value and average_order_value > 0)
    lo = average_order_value * MIN_PRICE_MULTIPLIER if has_aov else None
    hi = average_order_value * MAX_PRICE_MULTIPLIER if has_aov else None

    candidates = {}
    for idx, pid in enumerate(matrix_products):
        if pid in purchased or pid not in products_by_id:
            continue
        c_score = float(collab_row[idx]) if collab_row is not None else 0.0
        a_score = float(assoc_row[idx]) if assoc_row is not None else 0.0
        p_score = float(popularity.get(pid, 0.0))
        if c_score == 0.0 and a_score == 0.0 and p_score == 0.0:
            continue

        product = products_by_id[pid]
        stock = inventory_map.get(pid, 0)
        price = float(product.selling_price or 0)
        if stock < MIN_RECOMMENDABLE_STOCK or price <= 0:
            continue

        # BUG FIX: this band is now enforced unconditionally whenever we
        # know the customer's AOV — no "only if no other signal" escape.
        # This is what was letting ₹1 items past a ₹3,788 AOV customer.
        if has_aov and not (lo <= price <= hi):
            continue

        price_score = calculate_price_score(price, average_order_value)
        sources = set()
        if c_score > 0:
            sources.add("collaborative")
        if a_score > 0:
            sources.add("association")
        if p_score > 0 and c_score == 0 and a_score == 0:
            sources.add("popularity")

        final_score = w_collab * c_score + w_assoc * a_score + w_pop * p_score + PRICE_WEIGHT * price_score
        if len(sources) >= 2:
            final_score *= 1.10
        if a_score > 0.5:
            final_score *= 1.05

        candidates[pid] = {
            "score": final_score,
            "sources": sources,
            "price_score": price_score,
            "inventory": stock,
            "collaborative_score": c_score,
            "association_score": a_score,
            "popularity_score": p_score,
        }

    # Fallback: relax to price-compatible popularity ONLY if we're short
    # on real candidates — and the price band still applies here too.
    if len(candidates) < top_n:
        for pid, pop_score in popularity.sort_values(ascending=False).items():
            if len(candidates) >= top_n:
                break
            if pid in purchased or pid not in products_by_id or pid in candidates:
                continue
            product = products_by_id[pid]
            stock = inventory_map.get(pid, 0)
            price = float(product.selling_price or 0)
            if stock < MIN_RECOMMENDABLE_STOCK or price <= 0:
                continue
            if has_aov and not (lo <= price <= hi):
                continue
            price_score = calculate_price_score(price, average_order_value)
            candidates[pid] = {
                "score": w_pop * float(pop_score) + PRICE_WEIGHT * price_score,
                "sources": {"popularity"},
                "price_score": price_score,
                "inventory": stock,
                "collaborative_score": 0.0,
                "association_score": 0.0,
                "popularity_score": float(pop_score),
            }

    return sorted(candidates.items(), key=lambda kv: kv[1]["score"], reverse=True)[:top_n]


def _format_rows(customer, ranked, products_by_id, profile, purchased, reorder_history):
    recommendations = []
    for pid, info in ranked:
        product = products_by_id[pid]
        rec_type = classify_recommendation_type(product, profile.get("average_order_value"))
        recommendations.append(
            {
                "product_id": product.id,
                "product_name": product.name,
                "category": product.category.category_name if getattr(product, "category", None) else None,
                "price": float(product.selling_price or 0),
                "inventory_available": int(info["inventory"]),
                "recommendation_type": rec_type,
                "score": round(float(info["score"]), 4),
                "reason": build_explanation(info["sources"], rec_type),
                "signals": {
                    "collaborative_score": round(float(info.get("collaborative_score", 0.0)), 4),
                    "association_score": round(float(info.get("association_score", 0.0)), 4),
                    "popularity_score": round(float(info.get("popularity_score", 0.0)), 4),
                    "price_score": round(float(info.get("price_score", 0.0)), 4),
                    "signal_sources": sorted(info.get("sources", set())),
                },
            }
        )
    if not recommendations:
        return None
    return {
        "customer_id": customer.id,
        "customer_name": customer.full_name,
        "average_order_value": profile.get("average_order_value"),
        "total_orders": profile.get("total_orders", 0),
        "total_spent": profile.get("total_spent", 0),
        "recency_days": profile.get("recency_days"),
        "purchased_product_count": len(purchased),
        "repeat_purchase_products": len(reorder_history),
        "recommendations": recommendations,
        "recommended_products": [r["product_name"] for r in recommendations],
        "reason": recommendations[0]["reason"],
    }


# ============================================================
# SINGLE-CUSTOMER FAST PATH
# ============================================================

def generate_recommendations_for_customer(db, customer_id, top_n=TOP_N_RECOMMENDATIONS):
    """
    O(products) per request, not O(customers x products). Only the
    catalog-wide matrices (cached, TTL) are shared with the batch path;
    everything else here is scoped to this one customer.
    """
    from .. import models

    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        return None

    products_by_id = build_product_catalog(db)
    inventory_map = build_inventory_map(db)
    matrix, similarity, association_matrix, popularity = get_catalog_matrices(db)

    if matrix is None or matrix.empty:
        return None

    customer_sales = build_customer_sales_dataframe(db, customer_id)
    profile = _profile_from_sales(customer_sales)
    purchased = set(customer_sales["product_id"].unique()) if not customer_sales.empty else set()
    reorder_history = build_reorder_candidates(customer_sales)

    matrix_products = list(matrix.columns)

    if customer_id in matrix.index and len(purchased) >= MIN_ITEMS_FOR_COLLAB:
        purchase_row = matrix.loc[customer_id].values  # (products,)
        collab_row = purchase_row @ similarity.values if not similarity.empty else np.zeros(len(matrix_products))
        binary_row = (purchase_row > 0).astype(np.float64)
        assoc_row = binary_row @ association_matrix.values if not association_matrix.empty else np.zeros(len(matrix_products))

        # zero out already-purchased, then max-normalize (matches batch path)
        purchased_mask = purchase_row > 0
        collab_row = collab_row.copy()
        assoc_row = assoc_row.copy()
        collab_row[purchased_mask] = 0.0
        assoc_row[purchased_mask] = 0.0
        if collab_row.max() > 0:
            collab_row = collab_row / collab_row.max()
        if assoc_row.max() > 0:
            assoc_row = assoc_row / assoc_row.max()
    else:
        collab_row = np.zeros(len(matrix_products))
        assoc_row = np.zeros(len(matrix_products))

    ranked = _rank_candidates_for_customer(
        purchased, collab_row, assoc_row, popularity, products_by_id, inventory_map,
        profile.get("average_order_value"), matrix_products, top_n,
    )

    return _format_rows(customer, ranked, products_by_id, profile, purchased, reorder_history)


# ============================================================
# BATCH PATH — all customers (dashboard view)
# ============================================================

def generate_all_customer_recommendations(db, top_n=TOP_N_RECOMMENDATIONS):
    from .. import models

    customers = db.query(models.Customer).all()
    products_by_id = build_product_catalog(db)
    if not customers or not products_by_id:
        return {"customers_analyzed": 0, "recommendations_generated": 0, "rows": []}

    inventory_map = build_inventory_map(db)
    matrix, similarity, association_matrix, popularity = get_catalog_matrices(db)
    if matrix is None or matrix.empty:
        return {"customers_analyzed": len(customers), "recommendations_generated": 0, "rows": []}

    sales_df = build_sales_dataframe(db)
    customer_products = build_customer_product_sets(sales_df)
    customer_profiles = build_customer_profiles(sales_df)

    binary = (matrix.values > 0)
    collab_scores = matrix.values @ similarity.values if not similarity.empty else np.zeros(matrix.shape)
    assoc_scores = binary.astype(np.float64) @ association_matrix.values if not association_matrix.empty else np.zeros(matrix.shape)
    collab_scores = collab_scores.copy()
    assoc_scores = assoc_scores.copy()
    collab_scores[binary] = 0.0
    assoc_scores[binary] = 0.0

    row_max_c = collab_scores.max(axis=1, keepdims=True)
    row_max_c[row_max_c == 0] = 1.0
    collab_scores = collab_scores / row_max_c

    row_max_a = assoc_scores.max(axis=1, keepdims=True)
    row_max_a[row_max_a == 0] = 1.0
    assoc_scores = assoc_scores / row_max_a

    matrix_products = list(matrix.columns)
    customer_row_index = {cid: i for i, cid in enumerate(matrix.index)}

    rows = []
    for customer in customers:
        cid = customer.id
        purchased = customer_products.get(cid, set())
        profile = customer_profiles.get(
            cid, {"total_orders": 0, "total_spent": 0.0, "average_order_value": None, "recency_days": None}
        )

        if cid in customer_row_index:
            r = customer_row_index[cid]
            collab_row, assoc_row = collab_scores[r], assoc_scores[r]
        else:
            collab_row, assoc_row = np.zeros(len(matrix_products)), np.zeros(len(matrix_products))

        customer_sales = sales_df[sales_df["customer_id"] == cid] if not sales_df.empty else sales_df
        reorder_history = build_reorder_candidates(customer_sales)

        ranked = _rank_candidates_for_customer(
            purchased, collab_row, assoc_row, popularity, products_by_id, inventory_map,
            profile.get("average_order_value"), matrix_products, top_n,
        )
        row = _format_rows(customer, ranked, products_by_id, profile, purchased, reorder_history)
        if row:
            rows.append(row)

    return {
        "customers_analyzed": len(customers),
        "recommendations_generated": sum(len(r["recommendations"]) for r in rows),
        "rows": rows,
    }


# ============================================================
# ENTRY POINT — routes to fast path or batch path automatically
# ============================================================

def generate_product_recommendations(db, customer_id=None, top_n=TOP_N_RECOMMENDATIONS):
    if customer_id is not None:
        row = generate_recommendations_for_customer(db, customer_id, top_n=top_n)
        rows = [row] if row else []
        return {
            "customers_analyzed": 1,
            "recommendations_generated": len(rows[0]["recommendations"]) if rows else 0,
            "rows": rows,
        }
    return generate_all_customer_recommendations(db, top_n=top_n)


def generate_recommendations(db, customer_id=None, top_n=TOP_N_RECOMMENDATIONS):
    """Backwards-compatible wrapper."""
    return generate_product_recommendations(db, customer_id=customer_id, top_n=top_n)






# def save_recommendations(db, result):
#     """
#     Save generated recommendation results to the database.

#     Existing recommendations are replaced so the table always
#     represents the latest model output.
#     """
#     from .. import models

#     # Remove previous generated recommendations
#     db.query(models.ProductRecommendation).delete(
#         synchronize_session=False
#     )

#     saved_count = 0

#     for customer_row in result.get("rows", []):
#         customer_id = customer_row.get("customer_id")

#         for recommendation in customer_row.get("recommendations", []):
#             product_id = recommendation.get("product_id")

#             if not customer_id or not product_id:
#                 continue

#             db.add(
#                 models.ProductRecommendation(
#                     customer_id=customer_id,
#                     product_id=product_id,
#                     recommendation_type=recommendation.get(
#                         "recommendation_type"
#                     ),
#                     score=recommendation.get("score"),
#                 )
#             )

#             saved_count += 1

#     db.commit()

#     return saved_count


def save_recommendations(db, result):
    """
    Save generated recommendation results to the database.

    Existing recommendations are replaced so the table always
    represents the latest model output.
    """
    from .. import models

    # Remove previous generated recommendations
    db.query(models.ProductRecommendation).delete(
        synchronize_session=False
    )

    saved_count = 0

    for customer_row in result.get("rows", []):
        customer_id = customer_row.get("customer_id")

        for recommendation in customer_row.get("recommendations", []):
            product_id = recommendation.get("product_id")

            if not customer_id or not product_id:
                continue

            signals = recommendation.get("signals", {})

            db.add(
                models.ProductRecommendation(
                    customer_id=customer_id,
                    product_id=product_id,
                    recommendation_type=recommendation.get(
                        "recommendation_type"
                    ),
                    score=recommendation.get("score"),

                    # Preserve the actual ML signals
                    collaborative_score=signals.get(
                        "collaborative_score", 0
                    ),
                    association_score=signals.get(
                        "association_score", 0
                    ),
                    popularity_score=signals.get(
                        "popularity_score", 0
                    ),
                    price_score=signals.get(
                        "price_score", 0
                    ),
                    signal_sources=signals.get(
                        "signal_sources", []
                    ),
                )
            )

            saved_count += 1

    db.commit()

    return saved_count