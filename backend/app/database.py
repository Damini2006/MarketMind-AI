import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Defaults to a local SQLite file so the project runs with zero external setup.
# Set DATABASE_URL=postgresql://user:pass@host:5432/dbname to use PostgreSQL instead.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./marketmind.db")

IS_POSTGRES = DATABASE_URL.startswith("postgresql")
connect_args = {"check_same_thread": False} if not IS_POSTGRES else {}

if IS_POSTGRES:
    # Neon (serverless PostgreSQL) tuning:
    #  - connect_timeout: fail fast instead of hanging when compute is cold
    #  - pool_pre_ping: drop dead connections Neon has recycled (free tier
    #    suspends idle compute, which kills pooled connections)
    #  - pool_recycle: refresh connections before Neon's 5-min idle timeout
    engine = create_engine(
        DATABASE_URL,
        connect_args={"connect_timeout": 10},
        pool_pre_ping=True,
        pool_recycle=280,
        pool_size=10,
        max_overflow=5,
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