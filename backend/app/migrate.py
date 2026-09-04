"""Schema migration using Alembic for Neon PostgreSQL.

All schema changes are managed through Alembic migrations.
This module runs `alembic upgrade head` on startup.
"""
import os


def run_alembic_upgrade(engine) -> None:
    """Apply Alembic migrations for Neon PostgreSQL."""
    try:
        from alembic import command
        from alembic.config import Config
    except ImportError:
        print(
            "[migrate] alembic is not installed — run "
            "`pip install -r requirements.txt` to enable PostgreSQL migrations."
        )
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "migrations"))
    cfg.set_main_option("sqlalchemy.url", str(engine.url))

    print("[migrate] Running Alembic migrations...")
    command.upgrade(cfg, "head")


def ensure_business_id_columns(engine) -> None:
    """Run Alembic migrations for Neon PostgreSQL."""
    run_alembic_upgrade(engine)
