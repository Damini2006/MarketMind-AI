import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Neon PostgreSQL is the only supported database.
# DATABASE_URL must be set in .env — no local fallback.
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL is not set. Please configure it in backend/.env", file=sys.stderr)
    print("  Example: DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require", file=sys.stderr)
    sys.exit(1)

if "sqlite" in DATABASE_URL:
    print("ERROR: SQLite is not supported. Please use Neon PostgreSQL.", file=sys.stderr)
    print("  Set DATABASE_URL=postgresql://... in backend/.env", file=sys.stderr)
    sys.exit(1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
