"""Backfill audit_logs coordinates from stored IPs

Revision ID: 0006_add_audit_coords
Revises: 0005_add_audit_device_location
Create Date: 2026-09-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_add_audit_coords"
down_revision = "0005_add_audit_device_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
