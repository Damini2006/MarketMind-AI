"""Reconcile users table with current models (idempotent)

Historical drift (forked migration history + create_all on top of old
databases) left some environments without newer ``users`` columns even
though their alembic stamp looked current. This revision adds any missing
model-backed columns and, by being the single head, runs on every
environment that upgrades, making the schema converge.

Revision ID: f7a8b9c0d1e2
Revises: e3f4a5b6c7d8
Create Date: 2026-09-09 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f7a8b9c0d1e2"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None

# Column name -> (server DDL, SQLAlchemy type) applied only when missing.
_EXPECTED_USER_COLUMNS = {
    "phone": ("VARCHAR", sa.String()),
    "preferred_currency": ("VARCHAR DEFAULT 'INR'", sa.String()),
    "timezone": ("VARCHAR DEFAULT 'Asia/Kolkata'", sa.String()),
    "avatar_color": ("VARCHAR", sa.String()),
    "avatar_url": ("VARCHAR", sa.String()),
    "bio": ("TEXT", sa.Text()),
    "dob": ("DATE", sa.Date()),
    "tour_completed": ("BOOLEAN DEFAULT FALSE", sa.Boolean()),
    # Column from the retired forked history; no model uses it today, but it
    # is added so every environment converges on the same physical schema.
    "two_factor_enabled": ("BOOLEAN DEFAULT FALSE", sa.Boolean()),
}


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("users")}
    for name, (ddl, _sa_type) in _EXPECTED_USER_COLUMNS.items():
        if name not in existing:
            op.add_column("users", sa.Column(name, _sa_type, nullable=True))
            # Server default applied via raw DDL where the models expect one
            # at the database level (matches migrate.py's SQLite path).
            if "DEFAULT" in ddl:
                default = ddl.split("DEFAULT", 1)[1].strip()
                op.execute(f'ALTER TABLE users ALTER COLUMN "{name}" SET DEFAULT {default}')


def downgrade() -> None:
    # Intentionally a no-op: dropping user-profile columns would destroy data.
    pass
