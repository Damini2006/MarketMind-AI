"""Add businesses.invite_code for join-by-code signup.

Owners share this code so teammates can register into the SAME business —
previously every signup created its own business, which stranded
store_manager/sales_executive signups alone in an empty tenant and made the
role selector meaningless.

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("businesses")}
    if "invite_code" not in cols:
        op.add_column(
            "businesses",
            sa.Column("invite_code", sa.String(8), nullable=True),
        )
        op.create_index(
            "ix_businesses_invite_code", "businesses", ["invite_code"], unique=True
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("businesses")}
    if "invite_code" in cols:
        op.drop_index("ix_businesses_invite_code", table_name="businesses")
        op.drop_column("businesses", "invite_code")
