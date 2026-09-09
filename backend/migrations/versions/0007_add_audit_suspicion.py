"""0007 — Add suspicion flags to audit_logs.

Logins from a device or location the user has never used before are
flagged is_suspicious with a human-readable suspicion_reason so the
audit trail surfaces potential account takeovers.

Revision ID: 0007_add_audit_suspicion
Revises: 0006_add_audit_coords
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0007_add_audit_suspicion"
down_revision: Union[str, None] = "0006_add_audit_coords"
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

    if not _has_column(bind, "audit_logs", "is_suspicious"):
        op.add_column(
            "audit_logs",
            sa.Column("is_suspicious", sa.Boolean(), nullable=True, server_default="false"),
        )
        print("[migrate] audit_logs.is_suspicious added.")
    if not _has_column(bind, "audit_logs", "suspicion_reason"):
        op.add_column("audit_logs", sa.Column("suspicion_reason", sa.String(), nullable=True))
        print("[migrate] audit_logs.suspicion_reason added.")


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "audit_logs" not in tables:
        return
    if _has_column(bind, "audit_logs", "is_suspicious"):
        op.drop_column("audit_logs", "is_suspicious")
    if _has_column(bind, "audit_logs", "suspicion_reason"):
        op.drop_column("audit_logs", "suspicion_reason")