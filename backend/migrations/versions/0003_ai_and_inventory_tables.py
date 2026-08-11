"""0003 — Re-add the persisted AI and inventory/sale_items tables.

Revision 0001 dropped these tables when the app moved to computing everything
in memory. The pre-dev merge brings them back as first-class models so the
normalized schema (inventory, inventory_transactions, sale_items) and the
persisted ML outputs (customer_segments, forecasts, churn_predictions,
product_recommendations) are available again.

This revision is idempotent: every table is created only if missing, so it is
a no-op on databases that already have them (fresh installs get them via
``Base.metadata.create_all`` on startup anyway).

Revision ID: 0003_ai_and_inventory_tables
Revises: 0002_business_id_backfill
Create Date: 2026-08-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0003_ai_and_inventory_tables"
down_revision: Union[str, None] = "0002_business_id_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables(bind) -> set:
    return set(inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    existing = _tables(bind)

    if "inventory" not in existing:
        op.create_table(
            "inventory",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False, unique=True),
            sa.Column("quantity_available", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reorder_level", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("warehouse_location", sa.String(), nullable=True),
            sa.Column("last_updated", sa.DateTime(), nullable=True),
        )

    if "inventory_transactions" not in existing:
        op.create_table(
            "inventory_transactions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("transaction_type", sa.String(), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    if "sale_items" not in existing:
        op.create_table(
            "sale_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("sale_id", sa.Integer(), sa.ForeignKey("sales.id"), nullable=False),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Float(), nullable=False, server_default="0"),
            sa.Column("discount", sa.Float(), nullable=False, server_default="0"),
            sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        )

    if "customer_segments" not in existing:
        op.create_table(
            "customer_segments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
            sa.Column("segment_name", sa.String(), nullable=False),
            sa.Column("cluster_number", sa.Integer(), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("generated_at", sa.DateTime(), nullable=True),
        )

    if "forecasts" not in existing:
        op.create_table(
            "forecasts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id"), nullable=False),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
            sa.Column("forecast_date", sa.Date(), nullable=False),
            sa.Column("predicted_sales", sa.Float(), nullable=True),
            sa.Column("predicted_revenue", sa.Float(), nullable=True),
            sa.Column("model_used", sa.String(), nullable=True),
            sa.Column("confidence_score", sa.Float(), nullable=True),
            sa.Column("generated_at", sa.DateTime(), nullable=True),
        )

    if "churn_predictions" not in existing:
        op.create_table(
            "churn_predictions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
            sa.Column("churn_probability", sa.Float(), nullable=False),
            sa.Column("risk_level", sa.String(), nullable=False),
            sa.Column("recommendation", sa.Text(), nullable=True),
            sa.Column("generated_at", sa.DateTime(), nullable=True),
        )

    if "product_recommendations" not in existing:
        op.create_table(
            "product_recommendations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("recommendation_type", sa.String(), nullable=True),
            sa.Column("score", sa.Float(), nullable=True),
            sa.Column("generated_at", sa.DateTime(), nullable=True),
        )

    print("[migrate] AI + inventory tables ensured.")


def downgrade() -> None:
    bind = op.get_bind()
    existing = _tables(bind)
    for table in [
        "product_recommendations",
        "churn_predictions",
        "forecasts",
        "customer_segments",
        "sale_items",
        "inventory_transactions",
        "inventory",
    ]:
        if table in existing:
            op.drop_table(table)
