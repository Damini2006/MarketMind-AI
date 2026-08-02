import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict
from .models import RoleEnum

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.sales_executive
# ---------- Auth / Users ----------
    role: RoleEnum


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
    full_name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.sales_executive


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    role: RoleEnum
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- Customers ----------
class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class CustomerOut(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: dt.datetime


# ---------- Products / Inventory ----------
class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    price: float
    stock_quantity: int = 0
    reorder_threshold: int = 10
    warehouse_location: Optional[str] = None


class ProductOut(ProductCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class StockUpdate(BaseModel):
    quantity_delta: int  # positive to add stock, negative to deduct


# ---------- Sales ----------
class SaleCreate(BaseModel):
    customer_id: Optional[int] = None
    product_id: Optional[int] = None
    quantity: int = 1
    unit_price: float
    sale_date: Optional[dt.datetime] = None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: Optional[int]
    product_id: Optional[int]
    quantity: int
    unit_price: float
    total_amount: float
    sale_date: dt.datetime
    source: str


# ---------- Invoices ----------
class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    amount: float
    status: str = "pending"
    due_date: Optional[dt.datetime] = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: Optional[int]
    invoice_number: str
    amount: float
    status: str
    due_date: Optional[dt.datetime]
    created_at: dt.datetime


class InvoiceStatusUpdate(BaseModel):
    status: str


# ---------- Inventory Alerts ----------
class InventoryAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    message: str
    level: str
    created_at: dt.datetime
    resolved: bool


# ---------- AI Responses ----------
class ForecastPoint(BaseModel):
    period: str
    predicted_revenue: float


class ForecastResponse(BaseModel):
    history: List[dict]
    forecast: List[ForecastPoint]
    trend: str
    growth_pct: float
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None


class SegmentSummary(BaseModel):
    segment: str
    customer_count: int
    avg_purchase_value: float
    avg_purchase_frequency: float


class SegmentationResponse(BaseModel):
    segments: List[SegmentSummary]
    silhouette_score: Optional[float] = None
    customers: List[dict]


class ChurnRow(BaseModel):
    customer_id: int
    customer_name: str
    churn_probability: float
    risk_category: str
    recommendation: str


class ChurnResponse(BaseModel):
    rows: List[ChurnRow]
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None


class RecommendationRow(BaseModel):
    customer_id: int
    customer_name: str
    recommended_products: List[str]
    reason: str


class RecommendationResponse(BaseModel):
    rows: List[RecommendationRow]


class AnomalyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    description: str
    severity: str
    score: float
    created_at: dt.datetime


class AnomalyResponse(BaseModel):
    alerts: List[AnomalyOut]
    detection_accuracy: Optional[float] = None
    false_positive_rate: Optional[float] = None


class KPIResponse(BaseModel):
    total_revenue: float
    total_sales: int
    total_customers: int
    total_products: int
    low_stock_count: int
    pending_invoices: int
    overdue_invoices: int
    revenue_by_day: List[dict]
    top_products: List[dict]
