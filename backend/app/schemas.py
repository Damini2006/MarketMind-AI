from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models import RoleEnum


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum


class AuthUser(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: AuthUser


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: RoleEnum = RoleEnum.sales_executive


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: RoleEnum
    is_active: bool

    class Config:
        from_attributes = True


# ---------- Product / Inventory ----------
class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    price: float
    stock_qty: int = 0
    reorder_threshold: int = 10


class ProductOut(ProductCreate):
    id: int

    class Config:
        from_attributes = True


# ---------- Customer ----------
class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    segment: Optional[str]
    churn_probability: Optional[float]
    retention_risk: Optional[str]

    class Config:
        from_attributes = True


# ---------- Sales ----------
class SalesRecordCreate(BaseModel):
    product_id: int
    customer_id: Optional[int] = None
    quantity: int
    unit_price: float
    sale_date: Optional[datetime] = None


class SalesRecordOut(BaseModel):
    id: int
    product_id: int
    customer_id: Optional[int]
    quantity: int
    unit_price: float
    total_amount: float
    sale_date: datetime

    class Config:
        from_attributes = True


# ---------- Invoice ----------
class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    sales_record_id: Optional[int] = None
    amount: float
    status: str = "pending"


class InvoiceOut(InvoiceCreate):
    id: int
    invoice_number: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- ML outputs ----------
class ForecastPoint(BaseModel):
    date: str
    predicted_revenue: float


class ForecastResponse(BaseModel):
    history: List[dict]
    forecast: List[ForecastPoint]
    metrics: dict


class SegmentationResponse(BaseModel):
    segments: List[dict]
    metrics: dict


class ChurnResult(BaseModel):
    customer_id: int
    customer_name: str
    churn_probability: float
    retention_risk: str


class ChurnResponse(BaseModel):
    results: List[ChurnResult]
    metrics: dict


class RecommendationItem(BaseModel):
    product_id: int
    product_name: str
    score: float


class RecommendationResponse(BaseModel):
    customer_id: int
    recommendations: List[RecommendationItem]


class AnomalyOut(BaseModel):
    id: int
    alert_type: str
    description: str
    severity: str
    created_at: datetime

    class Config:
        from_attributes = True
