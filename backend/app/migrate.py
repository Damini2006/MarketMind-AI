"""Lightweight schema migration for multi-tenancy.

SQLite's ``create_all`` does not alter existing tables, so databases created
before the Business model existed keep their old columns. This module adds the
missing ``business_id`` column to every tenant-owned table and backfills rows
into a default business so existing data keeps working.

For PostgreSQL (and any other non-SQLite database) the hand-rolled SQLite path
cannot apply, so the project's Alembic migrations are run instead (see
backend/alembic/versions/).
"""
import datetime as dt
import os
from sqlalchemy import inspect, text

# Tables that own tenant-scoped rows and should carry a business_id column
TENANT_TABLES = [
    "users",
    "customers",
    "products",
    "sales",
    "invoices",
    "categories",
    "suppliers",
    "uploaded_datasets",
    "inventory_alerts",
    "anomaly_alerts",
    "notifications",
]

# Extra columns added to the users table after initial creation
USER_EXTRA_COLUMNS = {
    "phone": "VARCHAR",
    "preferred_currency": "VARCHAR DEFAULT 'INR'",
    "timezone": "VARCHAR DEFAULT 'Asia/Kolkata'",
    "avatar_color": "VARCHAR",
    "avatar_url": "VARCHAR",
    "bio": "TEXT",
    "dob": "DATE",
    "tour_completed": "BOOLEAN DEFAULT FALSE",
}


def run_alembic_upgrade(engine) -> None:
    """Apply Alembic migrations (PostgreSQL and other non-SQLite databases)."""
    try:
        from alembic import command
        from alembic.config import Config
        from alembic.script import ScriptDirectory
    except ImportError:
        print(
            "[migrate] alembic is not installed — run "
            "`pip install -r requirements.txt` to enable PostgreSQL migrations."
        )
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_dir = os.path.join(backend_dir, "alembic")
    
    # Skip if alembic directory doesn't exist
    if not os.path.isdir(alembic_dir):
        print("[migrate] alembic directory not found — skipping migration.")
        return

    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", str(engine.url))

    # Compare the DB's stamped revision(s) against the script head instead of
    # skipping on "any stamp exists": DBs stamped with a retired revision
    # (old forked history, retired custom numbering) must be brought up to
    # head, or their schema silently diverges from the models.
    try:
        heads = ScriptDirectory.from_config(cfg).get_heads()
    except Exception:
        heads = []
    try:
        with engine.connect() as conn:
            stamps = [r[0] for r in conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).fetchall()]
    except Exception:
        stamps = []  # no alembic_version table yet — fresh database

    if stamps == heads:
        print(f"[migrate] Already at migration head '{heads[0] if heads else '?'}' — skipping upgrade.")
        return

    if len(stamps) == 1 and stamps[0] not in heads:
        try:
            ScriptDirectory.from_config(cfg).get_revision(stamps[0])
        except Exception:
            # Unknown stamp: schema was built by other means (retired custom
            # migrations). create_all has already reconciled tables/columns,
            # so re-stamp instead of replaying history over existing tables.
            print(
                f"[migrate] Unknown stamp '{stamps[0]}' (retired migration "
                "history) — re-stamping to head instead of replaying."
            )
            try:
                # Alembic cannot re-stamp while the current stamp is unknown,
                # so clear the version table first.
                with engine.begin() as conn:
                    conn.execute(text("DELETE FROM alembic_version"))
            except Exception as exc:
                print(f"[migrate] Could not clear stale stamp (non-fatal): {exc}")
            try:
                command.stamp(cfg, "head")
            except Exception as exc:
                print(f"[migrate] Alembic stamp failed (non-fatal): {exc}")
            return

    print(f"[migrate] Running Alembic migrations (stamped {stamps or 'nothing'} -> head)...")
    try:
        command.upgrade(cfg, "head")
    except Exception as exc:
        msg = str(exc)
        if "already exists" in msg:
            # Tables were created by create_all on a previous run (fresh DB
            # bootstrapped without migrations). Adopt them instead of failing.
            print("[migrate] Tables already exist (create_all ran earlier) — stamping head instead.")
            try:
                command.stamp(cfg, "head")
            except Exception as exc2:
                print(f"[migrate] Alembic stamp failed (non-fatal): {exc2}")
        else:
            print(f"[migrate] Alembic upgrade failed (non-fatal): {exc}")


def ensure_business_id_columns(engine) -> None:
    if not engine.url.drivername.startswith("sqlite"):
        run_alembic_upgrade(engine)
        return

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        # 0. Add extra user columns (profile extras) on pre-existing DBs
        if "users" in tables:
            user_cols = {c["name"] for c in inspector.get_columns("users")}
            for col, ddl in USER_EXTRA_COLUMNS.items():
                if col not in user_cols:
                    conn.execute(
                        text(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
                    )

        # 1. Add missing business_id columns
        for table in TENANT_TABLES:
            if table not in tables:
                continue
            cols = {c["name"] for c in inspector.get_columns(table)}
            if "business_id" not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN business_id INTEGER"))

        # 2. Ensure a business exists to backfill existing rows into
        if "businesses" not in tables:
            return  # fresh DB will be created/backfilled by the seeder

        has_rows = False
        if "users" in tables:
            has_rows = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() > 0

        business_id = conn.execute(
            text("SELECT id FROM businesses ORDER BY id LIMIT 1")
        ).scalar()

        if business_id is None and has_rows:
            result = conn.execute(
                text(
                    "INSERT INTO businesses (company_name, created_at) "
                    "VALUES (:name, :ts)"
                ),
                {"name": "Default Business", "ts": dt.datetime.utcnow()},
            )
            business_id = result.lastrowid

        # 3. Backfill every tenant-owned table into that business
        if business_id is not None:
            for table in TENANT_TABLES:
                if table not in tables:
                    continue
                conn.execute(
                    text(
                        f"UPDATE {table} SET business_id = :b "
                        "WHERE business_id IS NULL"
                    ),
                    {"b": business_id},
                )
