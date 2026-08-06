import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file before anything else runs
load_dotenv()

from .database import Base, engine, SessionLocal
from .seed_data import seed_if_empty
from .routers import auth, customers, inventory, sales, invoices, analytics, ai

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - API",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note: Routers already include their /api/ path prefix internally.
# Including them directly prevents path doubling (e.g., /api/api/customers).
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(invoices.router)
app.include_router(analytics.router)
app.include_router(ai.router)


@app.on_event("startup")
def startup_seed():
    """Runs on backend server start to seed database if empty."""
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "MarketMind AI API is running. Visit /docs for interactive API documentation.",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}