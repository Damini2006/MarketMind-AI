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
    # Neon (serverless PostgreSQL) tuning:
    #  - connect_timeout: fail fast instead of hanging when compute is cold
    #  - pool_pre_ping: drop dead connections Neon has recycled (free tier
    #    suspends idle compute, which kills pooled connections)
    #  - pool_recycle: refresh connections before Neon's 5-min idle timeout
    #  - pool_timeout: fail fast if all connections are busy
    engine = create_engine(
        DATABASE_URL,
        connect_args={"connect_timeout": 5},
        pool_pre_ping=True,
        pool_recycle=280,
        pool_size=5,
        max_overflow=10,
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