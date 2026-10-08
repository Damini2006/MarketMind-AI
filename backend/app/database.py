import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# DATABASE_URL is REQUIRED. No silent fallback to a local SQLite file: that
# fallback made the app quietly create/point at ./marketmind.db whenever .env
# was missing or incomplete, which looked like "the database lost my account".
# Fail fast instead.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.stderr.write(
        "\n[config] DATABASE_URL is not set.\n"
        "[config] Add it to backend/.env, e.g.\n"
        "[config]   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require\n\n"
    )
    raise SystemExit(1)

IS_POSTGRES = DATABASE_URL.startswith("postgresql")
connect_args = {"check_same_thread": False} if not IS_POSTGRES else {}

if IS_POSTGRES:
    # Neon (serverless PostgreSQL) tuning.
    #
    # Connect through the DIRECT endpoint, not the `-pooler` one. Measured
    # from inside the container, both endpoints cost ~5s per fresh connection
    # (dominated by round-trip latency to us-east-2, not by the pooler), so the
    # pooler buys nothing here — and this process is a single long-lived server
    # with its own SQLAlchemy pool, which is the case the pooler is NOT for.
    # Going direct removes PgBouncer's transaction-mode caveats (no server-side
    # prepared statements, advisory locks or LISTEN/NOTIFY) and one more DNS
    # name that can fail to resolve.
    #
    #  - connect_timeout: fail fast instead of hanging when compute is cold
    #  - keepalives: a Neon compute that suspends (or a NAT that drops the
    #    mapping) leaves a half-open socket the OS would not otherwise notice
    #    for minutes; TCP keepalive surfaces it in ~30s so pool_pre_ping and
    #    the retry layer can act on a real error instead of stalling.
    #  - pool_pre_ping: drop dead connections Neon has recycled (free tier
    #    suspends idle compute, which kills pooled connections). Costs one
    #    round trip per checkout; worth it over this link.
    #  - pool_recycle: refresh connections before Neon's 5-min idle timeout
    #  - pool_use_lifo: hand back the most recently used connection first, so
    #    idle ones age out via pool_recycle instead of pinning Neon compute.
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        pool_pre_ping=True,
        pool_recycle=280,
        pool_use_lifo=True,
        pool_size=10,
        max_overflow=5,
        pool_timeout=10,
    )
else:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()