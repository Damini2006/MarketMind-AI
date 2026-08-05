import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, SessionLocal
from . import models
from .seed_data import seed_if_empty
from .routers import auth, customers, inventory, sales, invoices, analytics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(invoices.router)
app.include_router(analytics.router)



# Change this section in main.py:
@app.on_event("startup")
def startup_seed():
    db = SessionLocal()
    try:
        seed_if_empty(db)  # Runs automatically when database is empty
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
