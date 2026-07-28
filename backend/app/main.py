from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MarketMind AI",
    description="Small Business Sales Intelligence Platform - FastAPI backend",
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



@app.get("/")
def root():
    return {"message": "MarketMind AI API is running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
