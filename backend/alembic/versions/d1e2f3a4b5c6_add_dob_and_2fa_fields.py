"""Add DOB and 2FA fields to users

Revision ID: d1e2f3a4b5c6
Revises: ba757f8ac6d8
Create Date: 2026-08-13 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d1e2f3a4b5c6"
down_revision = "ba757f8ac6d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("dob", sa.Date(), nullable=True))
    op.add_column(
        "users",
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("two_factor_secret", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "two_factor_secret")
    op.drop_column("users", "two_factor_enabled")
    op.drop_column("users", "dob")
