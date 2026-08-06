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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.sales_executive)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    sales = relationship("Sale", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    stock_quantity = Column(Integer, nullable=False, default=0)
    reorder_threshold = Column(Integer, nullable=False, default=10)
    warehouse_location = Column(String, nullable=True)

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
    source = Column(String, default="manual")  # manual | csv_upload

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

    customer = relationship("Customer", back_populates="invoices")


class InventoryAlert(Base):
    __tablename__ = "inventory_alerts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    message = Column(String)
    level = Column(String, default="warning")  # info | warning | critical
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    resolved = Column(Boolean, default=False)


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)  # sales | inventory | revenue
    description = Column(Text)
    severity = Column(String, default="medium")  # low | medium | high
    score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    related_id = Column(Integer, nullable=True)

