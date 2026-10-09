"""Add refresh_tokens table

Short-lived access tokens need a refresh flow, so login sessions can stay
convenient without minting long-lived JWTs. Rows store only the SHA-256 hash
of each refresh token, grouped by family_id so a detected reuse can revoke
every token descended from one login.

Revision ID: c9d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-10-09 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c9d4e5f6a7b8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column("family_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
