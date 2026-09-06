"""0005 — Add device & location columns to audit_logs.

Stores parsed device info (browser · OS · form factor) and a
best-effort IP-derived location string on every audit entry so
the trail is useful for security review.

Revision ID: 0005_add_audit_device_location
Revises: 0004_add_notifications
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0005_add_audit_device_location"
down_revision: Union[str, None] = "0004_add_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(bind).get_columns(table)]
    return column in cols


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "audit_logs" not in tables:
        print("[migrate] audit_logs table missing — skipping column adds.")
        return

    if not _has_column(bind, "audit_logs", "device"):
        op.add_column("audit_logs", sa.Column("device", sa.String(), nullable=True))
        print("[migrate] audit_logs.device added.")
    if not _has_column(bind, "audit_logs", "location"):
        op.add_column("audit_logs", sa.Column("location", sa.String(), nullable=True))
        print("[migrate] audit_logs.location added.")


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "audit_logs" not in tables:
        return
    if _has_column(bind, "audit_logs", "device"):
        op.drop_column("audit_logs", "device")
    if _has_column(bind, "audit_logs", "location"):
        op.drop_column("audit_logs", "location")