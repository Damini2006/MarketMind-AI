"""Add device, location columns to audit_logs

Revision ID: 0005_add_audit_device_location
Revises: 0004_add_notifications
Create Date: 2026-09-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_add_audit_device_location"
down_revision = "0004_add_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("device", sa.String(), nullable=True))
    op.add_column("audit_logs", sa.Column("location", sa.String(), nullable=True))
    op.add_column("audit_logs", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("audit_logs", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "longitude")
    op.drop_column("audit_logs", "latitude")
    op.drop_column("audit_logs", "location")
    op.drop_column("audit_logs", "device")
