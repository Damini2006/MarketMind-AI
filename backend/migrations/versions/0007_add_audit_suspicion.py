"""Add is_suspicious, suspicion_reason to audit_logs

Revision ID: 0007_add_audit_suspicion
Revises: 0006_add_audit_coords
Create Date: 2026-09-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_add_audit_suspicion"
down_revision = "0006_add_audit_coords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("is_suspicious", sa.Boolean(), nullable=True))
    op.add_column("audit_logs", sa.Column("suspicion_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "suspicion_reason")
    op.drop_column("audit_logs", "is_suspicious")
