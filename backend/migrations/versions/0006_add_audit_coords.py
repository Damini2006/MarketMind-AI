"""0006 — Add latitude & longitude to audit_logs.

Stores the coordinates behind each login's location string so the Audit
Trail page can render a map of where logins came from.

Revision ID: 0006_add_audit_coords
Revises: 0005_add_audit_device_location
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0006_add_audit_coords"
down_revision: Union[str, None] = "0005_add_audit_device_location"
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

    if not _has_column(bind, "audit_logs", "latitude"):
        op.add_column("audit_logs", sa.Column("latitude", sa.Float(), nullable=True))
        print("[migrate] audit_logs.latitude added.")
    if not _has_column(bind, "audit_logs", "longitude"):
        op.add_column("audit_logs", sa.Column("longitude", sa.Float(), nullable=True))
        print("[migrate] audit_logs.longitude added.")


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "audit_logs" not in tables:
        return
    if _has_column(bind, "audit_logs", "latitude"):
        op.drop_column("audit_logs", "latitude")
    if _has_column(bind, "audit_logs", "longitude"):
        op.drop_column("audit_logs", "longitude")