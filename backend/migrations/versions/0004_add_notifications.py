"""0004 — Add notifications table.

The notifications table was created by Base.metadata.create_all() on startup
but Alembic's version table recorded 0004_add_notifications, causing a
"Can't locate revision" error when running migrations from a fresh clone.

This stub migration is idempotent: it only creates the table if missing.

Revision ID: 0004_add_notifications
Revises: 0003_ai_and_inventory_tables
Create Date: 2026-09-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0004_add_notifications"
down_revision: Union[str, None] = "0003_ai_and_inventory_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())

    if "notifications" not in existing:
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id"), nullable=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("notification_type", sa.String(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=True, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    print("[migrate] notifications table ensured.")


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())
    if "notifications" in existing:
        op.drop_table("notifications")
