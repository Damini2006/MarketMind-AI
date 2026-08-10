import enum
import datetime as dt
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, Text
)
from sqlalchemy.orm import relationship
from .database import Base


class RoleEnum(str, enum.Enum):
    business_owner = "business_owner"
    store_manager = "store_manager"
    sales_executive = "sales_executive"
    admin = "admin"


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    users = relationship("User", back_populates="business")
    customers = relationship("Customer", back_populates="business")
    categories = relationship("Category", back_populates="business")
    suppliers = relationship("Supplier", back_populates="business")
    products = relationship("Product", back_populates="business")
    sales = relationship("Sale", back_populates="business")
    invoices = relationship("Invoice", back_populates="business")
    inventory_alerts = relationship("InventoryAlert", back_populates="business")
    anomaly_alerts = relationship("AnomalyAlert", back_populates="business")
    uploaded_datasets = relationship("UploadedDataset", back_populates="business")
    notifications = relationship("Notification", back_populates="business")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.sales_executive)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    # Password Reset OTP fields
    reset_otp = Column(String, nullable=True)
    reset_otp_expiry = Column(DateTime, nullable=True)

    # Profile extras
    phone = Column(String, nullable=True)
    preferred_currency = Column(String, default="INR")
    timezone = Column(String, default="Asia/Kolkata")
    avatar_color = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)  # served from /uploads/avatars
    bio = Column(Text, nullable=True)

    # Multi-tenancy
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="users")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="customers")
    sales = relationship("Sale", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="categories")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="suppliers")


class UploadedDataset(Base):
    __tablename__ = "uploaded_datasets"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    file_path = Column(Text, nullable=True)
    upload_date = Column(DateTime, default=dt.datetime.utcnow)
    validation_status = Column(String, default="pending")
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="uploaded_datasets")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    stock_quantity = Column(Integer, nullable=False, default=0)
    reorder_threshold = Column(Integer, nullable=False, default=10)
    warehouse_location = Column(String, nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="products")
    sales = relationship("Sale", back_populates="product")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    sale_date = Column(DateTime, default=dt.datetime.utcnow)
    source = Column(String, default="manual")  # manual | csv_upload | seed

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    product = relationship("Product", back_populates="sales")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    invoice_number = Column(String, unique=True, index=True)
    amount = Column(Float, nullable=False, default=0.0)
    status = Column(String, default="pending")  # pending | paid | overdue
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")


class InventoryAlert(Base):
    __tablename__ = "inventory_alerts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    message = Column(String)
    level = Column(String, default="warning")  # info | warning | critical
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    resolved = Column(Boolean, default=False)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="inventory_alerts")


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)  # sales | inventory | revenue
    description = Column(Text)
    severity = Column(String, default="medium")  # low | medium | high
    score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    related_id = Column(Integer, nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="anomaly_alerts")


class Notification(Base):
    """Unified in-app notification, synced from app events (low stock,
    anomaly alerts, overdue invoices). Idempotent per source_type+source_id."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)  # inventory | anomaly | invoice
    title = Column(String)
    message = Column(Text)
    level = Column(String, default="info")  # info | warning | critical
    link = Column(String, nullable=True)
    source_type = Column(String, nullable=True)
    source_id = Column(Integer, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)

    business = relationship("Business", back_populates="notifications")
