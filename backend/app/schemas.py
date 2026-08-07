import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict

# --- Core Schema ---

class RoleBase(BaseModel):
    role_name: str
    description: Optional[str] = None

class RoleOut(RoleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

class BusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_name: str
    created_at: dt.datetime

class RegisterRequest(BaseModel):
    company_name: str
    full_name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthUser(BaseModel):
    id: int
    full_name: str
    email: str
    role: RoleOut
    business: BusinessOut

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: RoleOut
    business: BusinessOut
    is_active: bool

class UserRoleUpdate(BaseModel):
    role_name: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Customers ---
class CustomerCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[dt.date] = None
    address: Optional[str] = None

class CustomerOut(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total_orders: int
    total_spent: float
    last_purchase_date: Optional[dt.date]
    created_at: dt.datetime

# --- Categories & Suppliers ---
class CategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None

class CategoryOut(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class SupplierCreate(BaseModel):
    supplier_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierOut(SupplierCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

# --- Products & Inventory ---
class ProductCreate(BaseModel):
    name: str
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    purchase_price: float = 0.0
    selling_price: float = 0.0
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    
    # Optional fields for initial inventory
    stock_quantity: int = 0
    reorder_level: int = 10
    warehouse_location: Optional[str] = None

class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category_id: Optional[int]
    supplier_id: Optional[int]
    sku: Optional[str]
    barcode: Optional[str]
    purchase_price: float
    selling_price: float
    description: Optional[str]
    image_url: Optional[str]
    is_active: bool
    created_at: dt.datetime

class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity_available: int
    reorder_level: int
    warehouse_location: Optional[str]
    last_updated: dt.datetime

class InventoryTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    user_id: Optional[int]
    transaction_type: str
    quantity: int
    remarks: Optional[str]
    created_at: dt.datetime

class StockUpdate(BaseModel):
    quantity_delta: int  # positive to add stock, negative to deduct
    transaction_type: str = "ADJUSTMENT"
    remarks: Optional[str] = None

# --- Sales & Invoices ---
class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = 1
    unit_price: float
    discount: float = 0.0

class SaleItemOut(SaleItemCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sale_id: int
    total: float

class SaleCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    payment_method: Optional[str] = None
    sale_date: Optional[dt.datetime] = None
    items: List[SaleItemCreate]

class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_number: Optional[str]
    customer_id: Optional[int]
    user_id: Optional[int]
    subtotal: float
    tax: float
    discount: float
    total_amount: float
    payment_status: str
    payment_method: Optional[str]
    sale_date: dt.datetime
    sale_items: List[SaleItemOut] = []

class InvoiceCreate(BaseModel):
    sale_id: Optional[int] = None
    due_date: Optional[dt.date] = None

class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sale_id: Optional[int]
    invoice_number: str
    due_date: Optional[dt.date]
    payment_date: Optional[dt.date]
    invoice_status: str
    pdf_url: Optional[str]
    created_at: dt.datetime

class InvoiceStatusUpdate(BaseModel):
    status: str

# --- Uploaded Datasets & Alerts ---
class UploadedDatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uploaded_by: Optional[int]
    file_name: str
    file_path: Optional[str]
    upload_date: dt.datetime
    validation_status: str
    total_records: int
    valid_records: int
    invalid_records: int

class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    alert_type: str
    title: str
    description: Optional[str]
    priority: str
    is_read: bool
    created_at: dt.datetime

class AnomalyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    anomaly_type: str
    reference_id: Optional[int]
    severity: str
    confidence: float
    description: Optional[str]
    detected_at: dt.datetime
    resolved: bool

# --- AI Responses ---
class CustomerSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    segment_name: str
    cluster_number: int
    confidence: Optional[float]
    generated_at: dt.datetime

class ForecastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: Optional[int]
    forecast_date: dt.date
    predicted_sales: Optional[float]
    predicted_revenue: Optional[float]
    model_used: Optional[str]
    confidence_score: Optional[float]
    generated_at: dt.datetime

class ChurnPredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    churn_probability: float
    risk_level: str
    recommendation: Optional[str]
    generated_at: dt.datetime

class ProductRecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    product_id: int
    recommendation_type: Optional[str]
    score: Optional[float]
    generated_at: dt.datetime

# Aggregated responses for Analytics (Phase 1)
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
