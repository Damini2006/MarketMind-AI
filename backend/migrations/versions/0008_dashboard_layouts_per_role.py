"""0008 — Let each team role pick its own dashboard layout.

dashboard_layouts previously had a single active layout per *business*, so an
owner's save silently repointed the dashboard for every store manager and sales
exec in the tenant. Add a `role` column and backfill each existing row with the
role of the user who created it.

Backfill matters: rows created before this column existed are otherwise NULL,
and NULL is treated as "shared", which would leave the original owner seeing
everyone else's layouts. Deriving the role from users.id keeps each existing
arrangement with the person who made it.

Revision ID: 0008_dashboard_layouts_per_role
Revises: 0007_add_audit_suspicion
Create Date: 2026-10-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0008_dashboard_layouts_per_role"
down_revision: Union[str, None] = "0007_add_audit_suspicion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(bind).get_columns(table)]
    return column in cols


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "dashboard_layouts" not in tables:
        print("[migrate] dashboard_layouts table missing — skipping role backfill.")
        return

    if not _has_column(bind, "dashboard_layouts", "role"):
        op.add_column(
            "dashboard_layouts",
            sa.Column("role", sa.String(), nullable=True),
        )
        print("[migrate] dashboard_layouts.role added.")

    # Backfill from the creating user's role. SQLite/Postgres both accept a
    # correlated UPDATE; guarded so re-running the migration is harmless.
    if "users" in tables and "role" in [
        c["name"] for c in inspect(bind).get_columns("users")
    ]:
        bind.execute(
            sa.text(
                """
                UPDATE dashboard_layouts
                   SET role = (
                       SELECT u.role FROM users u WHERE u.id = dashboard_layouts.user_id
                   )
                 WHERE role IS NULL
                   AND user_id IS NOT NULL
                """
            )
        )
        print("[migrate] dashboard_layouts.role backfilled from users.role.")

    # Index for the per-role lookup the routes now do.
    try:
        op.create_index("ix_dashboard_layouts_role", "dashboard_layouts", ["role"])
        print("[migrate] ix_dashboard_layouts_role created.")
    except Exception as exc:  # already present on some backends
        print(f"[migrate] role index skipped: {exc}")


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "dashboard_layouts" not in tables:
        return
    try:
        op.drop_index("ix_dashboard_layouts_role", table_name="dashboard_layouts")
    except Exception:
        pass
    if _has_column(bind, "dashboard_layouts", "role"):
        op.drop_column("dashboard_layouts", "role")
        print("[migrate] dashboard_layouts.role dropped.")