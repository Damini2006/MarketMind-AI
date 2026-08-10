"""0002 — Ensure every tenant table has business_id and backfill rows.

The legacy Neon schema never had ``business_id`` on ``invoices``,
``inventory_alerts`` or ``anomaly_alerts`` (and possibly other tables on other
legacy databases). This revision mirrors what the SQLite path in
``backend/app/migrate.py`` does: add ``business_id`` to every tenant-owned
table that is missing it, make sure a business exists, and backfill existing
rows into the first business so tenant scoping keeps working.

Guarded per table, so it is a no-op on databases that already have the column.

Revision ID: 0002_business_id_backfill
Revises: 0001_legacy_to_current
Create Date: 2026-08-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision: str = "0002_business_id_backfill"
down_revision: Union[str, None] = "0001_legacy_to_current"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_TABLES = [
    "users",
    "customers",
    "products",
    "sales",
    "invoices",
    "categories",
    "suppliers",
    "uploaded_datasets",
    "inventory_alerts",
    "anomaly_alerts",
    "notifications",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    added = []
    # Add the column where missing (per-table, so this is idempotent)
    for table in TENANT_TABLES:
        if table not in tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        if "business_id" not in cols:
            op.add_column(table, sa.Column("business_id", sa.Integer(), nullable=True))
            added.append(table)

    # Re-read table list in case create_all hasn't run (fresh DB)
    tables = set(inspect(bind).get_table_names())

    # Make sure at least one business exists to backfill into
    if "businesses" in tables:
        business_id = bind.execute(
            text("SELECT id FROM businesses ORDER BY id LIMIT 1")
        ).scalar()
        if business_id is None:
            has_rows = any(
                t in tables
                and bind.execute(text(f"SELECT 1 FROM {t} LIMIT 1")).scalar() is not None
                for t in TENANT_TABLES
            )
            if has_rows:
                business_id = bind.execute(
                    text("INSERT INTO businesses (company_name, created_at) "
                         "VALUES ('Default Business', now()) RETURNING id")
                ).scalar()

        # Backfill existing rows into the first business
        if business_id is not None:
            for table in TENANT_TABLES:
                if table in tables:
                    bind.execute(
                        text(f"UPDATE {table} SET business_id = :b WHERE business_id IS NULL"),
                        {"b": business_id},
                    )

    print(f"[migrate] business_id ensured on: {added or 'none (already current)'}")


def downgrade() -> None:
    # business_id is required by the current models — keep it. Nothing to undo.
    pass
