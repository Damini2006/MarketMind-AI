"""Copy every row from the current DATABASE_URL database to a target database.

Use this to move to a new Neon project in a closer region (a Neon project's
region is fixed at creation, so you must create a new project and migrate the
data). No pg_dump/psql needed — this uses SQLAlchemy.

Usage:
    python copy_neon_data.py "postgresql://user:pass@host/dbname"

Notes:
- Row IDs are preserved so foreign keys stay intact.
- Sequences (auto-increment counters) are re-synced afterwards.
- The target is truncated first (reverse FK order), so re-running is safe.
- The target should already have the schema: boot the backend against it once
  (Alembic creates tables at startup), or run
  `python -m alembic upgrade head`.
- `alembic_version` is NOT copied — the target keeps its own migration state.
"""
import sys
import os
from dotenv import load_dotenv

load_dotenv(".env")

from sqlalchemy import create_engine, text

# FK-safe order: parents before children.
TABLES = [
    "businesses",
    "users",
    "categories",
    "suppliers",
    "customers",
    "products",
    "invoices",
    "sales",
    "inventory_alerts",
    "notifications",
    "anomaly_alerts",
    "uploaded_datasets",
]


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    target_url = sys.argv[1]
    source_url = os.getenv("DATABASE_URL", "")
    if not source_url:
        print("No DATABASE_URL found in .env — nothing to copy from.")
        sys.exit(1)
    if source_url == target_url:
        print("Source and target are the same — aborting.")
        sys.exit(1)

    src = create_engine(source_url)
    dst = create_engine(target_url)

    # Truncate target in reverse order so child tables go first.
    is_sqlite = target_url.startswith("sqlite")
    with dst.begin() as conn:
        for t in reversed(TABLES):
            if is_sqlite:
                conn.execute(text(f'DELETE FROM "{t}"'))
            else:
                conn.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))

    total = 0
    with src.connect() as sconn, dst.begin() as dconn:
        for t in TABLES:
            rows = sconn.execute(text(f'SELECT * FROM "{t}"')).mappings().all()
            if not rows:
                print(f"  {t}: 0 rows (skip)")
                continue
            cols = list(rows[0].keys())
            quoted = ", ".join(f'"{c}"' for c in cols)
            placeholders = ", ".join(f":{c}" for c in cols)
            dconn.execute(
                text(f'INSERT INTO "{t}" ({quoted}) VALUES ({placeholders})'),
                [dict(r) for r in rows],
            )
            print(f"  {t}: {len(rows)} rows")
            total += len(rows)

        # Re-sync sequences (Postgres). SQLite has no sequences — guarded.
        for t in TABLES:
            try:
                seq = dconn.execute(
                    text("SELECT pg_get_serial_sequence('public." + t + "', 'id')")
                ).scalar()
                if seq:
                    dconn.execute(
                        text(
                            f"SELECT setval('{seq}', "
                            f"COALESCE((SELECT MAX(id) FROM \"{t}\"), 1))"
                        )
                    )
            except Exception:
                pass

    print(f"\nDone - copied {total} rows to {target_url.split('@')[-1]}")


if __name__ == "__main__":
    main()
