from datetime import datetime

import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


MODEL_PATH = "app/trained_models/customer_segmentation.pkl"
SCALER_PATH = "app/trained_models/customer_scaler.pkl"


FEATURE_COLUMNS = [
    "recency",
    "frequency",
    "monetary",
    "avg_order_value",
    "total_quantity",
    "avg_quantity",
    "avg_unit_price",
    "total_discount",
    "avg_discount",
    "customer_tenure",
]


def build_customer_features(db):
    """
    Build customer-level behavioral features from the
    actual PostgreSQL sales data.
    """

    from ..models import Customer, Sale, SaleItem

    customers = db.query(Customer).all()

    rows = []

    now = datetime.utcnow()

    for customer in customers:

        sales = (
            db.query(Sale)
            .filter(Sale.customer_id == customer.id)
            .order_by(Sale.sale_date.asc())
            .all()
        )

        # Customers with no transactions cannot be meaningfully
        # segmented using purchase behavior.
        if not sales:
            continue

        sale_ids = [sale.id for sale in sales]

        items = (
            db.query(SaleItem)
            .filter(SaleItem.sale_id.in_(sale_ids))
            .all()
        )

        # total_spent = sum(float(s.total_amount or 0) for s in sales)
        total_spent = sum(
    float(item.total or 0)
    for item in items
)

        frequency = len(sales)

        first_purchase = min(
            sale.sale_date for sale in sales if sale.sale_date
        )

        last_purchase = max(
            sale.sale_date for sale in sales if sale.sale_date
        )

        recency = max(
            (now - last_purchase).days,
            0
        )

        customer_tenure = max(
            (last_purchase - first_purchase).days,
            0
        )

        total_quantity = sum(
            int(item.quantity or 0)
            for item in items
        )

        avg_quantity = (
            total_quantity / len(items)
            if items
            else 0
        )

        avg_unit_price = (
            sum(float(item.unit_price or 0) for item in items)
            / len(items)
            if items
            else 0
        )

        total_discount = sum(
            float(item.discount or 0)
            for item in items
        )

        avg_discount = (
            total_discount / len(items)
            if items
            else 0
        )

        avg_order_value = (
            total_spent / frequency
            if frequency > 0
            else 0
        )

        rows.append(
            {
                "customer_id": customer.id,
                "customer_name": customer.full_name,
                "recency": recency,
                "frequency": frequency,
                "monetary": total_spent,
                "avg_order_value": avg_order_value,
                "total_quantity": total_quantity,
                "avg_quantity": avg_quantity,
                "avg_unit_price": avg_unit_price,
                "total_discount": total_discount,
                "avg_discount": avg_discount,
                "customer_tenure": customer_tenure,
            }
        )

    return pd.DataFrame(rows)


def train_customer_segmentation(db):

    df = build_customer_features(db)

    if len(df) < 3:
        raise ValueError(
            "At least 3 customers with purchase history "
            "are required for segmentation."
        )

    X = df[FEATURE_COLUMNS].copy()

    # Handle any missing/infinite values
    X = X.replace([float("inf"), float("-inf")], pd.NA)
    X = X.fillna(0)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Find best number of clusters
    max_k = min(8, len(df) - 1)

    scores = {}

    for k in range(2, max_k + 1):

        model = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=20,
        )

        labels = model.fit_predict(X_scaled)

        score = silhouette_score(
            X_scaled,
            labels,
        )

        scores[k] = score

    best_k = max(
        scores,
        key=scores.get,
    )

    # Train final model
    model = KMeans(
        n_clusters=best_k,
        random_state=42,
        n_init=20,
    )

    df["cluster"] = model.fit_predict(X_scaled)

    # Determine cluster characteristics
        # Determine cluster characteristics
    cluster_summary = (
        df.groupby("cluster")
        .agg(
            customer_count=("customer_id", "count"),
            avg_monetary=("monetary", "mean"),
            avg_frequency=("frequency", "mean"),
            avg_recency=("recency", "mean"),
        )
        .reset_index()
    )

    # ---------------------------------------------------------
    # Assign business-friendly names based on behavior
    # ---------------------------------------------------------
    #
    # K-Means cluster numbers are arbitrary.
    # Therefore, names are assigned using behavioral
    # characteristics rather than cluster IDs.
    # ---------------------------------------------------------

    def assign_segment_names(summary):

        summary = summary.copy()

        # Higher spending = better
        summary["monetary_rank"] = (
            summary["avg_monetary"].rank(pct=True)
        )

        # More orders = better
        summary["frequency_rank"] = (
            summary["avg_frequency"].rank(pct=True)
        )

        # Lower recency = better
        # Negating recency makes recent customers rank higher.
        summary["recency_rank"] = (
            (-summary["avg_recency"]).rank(pct=True)
        )

        # Combined behavioral score
        summary["behavior_score"] = (
            0.40 * summary["monetary_rank"]
            + 0.35 * summary["frequency_rank"]
            + 0.25 * summary["recency_rank"]
        )

        segment_map = {}

        for _, row in summary.iterrows():

            cluster = row["cluster"]
            monetary = row["monetary_rank"]
            frequency = row["frequency_rank"]
            recency = row["recency_rank"]

            # High spending + frequent + reasonably recent
            if (
                monetary >= 0.80
                and frequency >= 0.80
                and recency >= 0.50
            ):
                segment = "VIP Champions"

            # Very frequent and high-value customers
            elif (
                frequency >= 0.75
                and monetary >= 0.60
            ):
                segment = "High Value Customers"

            # High spending but lower frequency
            elif (
                monetary >= 0.70
                and frequency < 0.75
            ):
                segment = "At-Risk High Value Customers"

            # Frequent customers with moderate spending
            elif (
                frequency >= 0.60
                and monetary >= 0.40
            ):
                segment = "Loyal Customers"

            # Recent customers with relatively few purchases
            elif (
                recency >= 0.70
                and frequency < 0.50
            ):
                segment = "New / Potential Customers"

            # Customers who have not purchased recently
            elif recency <= 0.30:
                segment = "Dormant Customers"

            # Low spending + low frequency
            elif (
                monetary < 0.40
                and frequency < 0.50
            ):
                segment = "Budget Customers"

            # Everything else
            else:
                segment = "Regular Customers"

            segment_map[cluster] = segment

        return segment_map

    # Assign segment names
    segment_map = assign_segment_names(cluster_summary)

    df["segment"] = df["cluster"].map(segment_map)

    # Save trained model and scaler
    joblib.dump(
        model,
        MODEL_PATH,
    )

    joblib.dump(
        scaler,
        SCALER_PATH,
    )

    return {
        "data": df,
        "best_k": best_k,
        "silhouette_score": round(
            scores[best_k],
            4,
        ),
        "scores": {
            str(k): round(score, 4)
            for k, score in scores.items()
        },
    }
    