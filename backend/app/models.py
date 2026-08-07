import datetime as dt
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Date
)
from sqlalchemy.orm import relationship
from .database import Base

# --- Phase 1: Core Schema ---

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
    alerts = relationship("Alert", back_populates="business")
    forecasts = relationship("Forecast", back_populates="business")

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    profile_image = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    
    role = relationship("Role", back_populates="users")
    business = relationship("Business", back_populates="users")
    
    sales = relationship("Sale", back_populates="user")
    inventory_transactions = relationship("InventoryTransaction", back_populates="user")
    uploaded_datasets = relationship("UploadedDataset", back_populates="user")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    dob = Column(Date, nullable=True)
    address = Column(Text, nullable=True)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    last_purchase_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    sales = relationship("Sale", back_populates="customer")
    segments = relationship("CustomerSegment", back_populates="customer")
    churn_predictions = relationship("ChurnPrediction", back_populates="customer")
    recommendations = relationship("ProductRecommendation", back_populates="customer")
    business = relationship("Business", back_populates="customers")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    category_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    products = relationship("Product", back_populates="category")
    business = relationship("Business", back_populates="categories")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    supplier_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)

    products = relationship("Product", back_populates="supplier")
    business = relationship("Business", back_populates="suppliers")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    
    name = Column(String, nullable=False)
    sku = Column(String, nullable=True, unique=True, index=True)
    barcode = Column(String, nullable=True)
    purchase_price = Column(Float, nullable=False, default=0.0)
    selling_price = Column(Float, nullable=False, default=0.0)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", uselist=False)
    sale_items = relationship("SaleItem", back_populates="product")
    forecasts = relationship("Forecast", back_populates="product")
    recommendations = relationship("ProductRecommendation", back_populates="product")
    business = relationship("Business", back_populates="products")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    quantity_available = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=10)
    warehouse_location = Column(String, nullable=True)
    last_updated = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    product = relationship("Product", back_populates="inventory")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    transaction_type = Column(String, nullable=False)  # IN, OUT, RETURN, ADJUSTMENT
    quantity = Column(Integer, nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    user = relationship("User", back_populates="inventory_transactions")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    invoice_number = Column(String, unique=True, index=True, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subtotal = Column(Float, nullable=False, default=0.0)
    tax = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    payment_status = Column(String, default="completed")
    payment_method = Column(String, nullable=True)
    sale_date = Column(DateTime, default=dt.datetime.utcnow)

    customer = relationship("Customer", back_populates="sales")
    user = relationship("User", back_populates="sales")
    sale_items = relationship("SaleItem", back_populates="sale")
    invoice = relationship("Invoice", back_populates="sale", uselist=False)
    business = relationship("Business", back_populates="sales")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)

    sale = relationship("Sale", back_populates="sale_items")
    product = relationship("Product", back_populates="sale_items")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    invoice_number = Column(String, unique=True, index=True)
    due_date = Column(Date, nullable=True)
    payment_date = Column(Date, nullable=True)
    invoice_status = Column(String, default="pending")  # pending, paid, overdue
    pdf_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    sale = relationship("Sale", back_populates="invoice")


class UploadedDataset(Base):
    __tablename__ = "uploaded_datasets"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(Text, nullable=True)
    upload_date = Column(DateTime, default=dt.datetime.utcnow)
    validation_status = Column(String, default="pending")
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)

    user = relationship("User", back_populates="uploaded_datasets")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    alert_type = Column(String, nullable=False)  # e.g., "inventory", "ai"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="medium")  # low, medium, high, critical
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    
    business = relationship("Business", back_populates="alerts")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_type = Column(String, nullable=False)
    reference_id = Column(Integer, nullable=True)
    severity = Column(String, default="medium")
    confidence = Column(Float, default=0.0)
    description = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=dt.datetime.utcnow)
    resolved = Column(Boolean, default=False)


# --- Phase 2: AI Tables ---

class CustomerSegment(Base):
    __tablename__ = "customer_segments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    segment_name = Column(String, nullable=False)
    cluster_number = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=True)
    generated_at = Column(DateTime, default=dt.datetime.utcnow)

    customer = relationship("Customer", back_populates="segments")


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    forecast_date = Column(Date, nullable=False)
    predicted_sales = Column(Float, nullable=True)
    predicted_revenue = Column(Float, nullable=True)
    model_used = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    generated_at = Column(DateTime, default=dt.datetime.utcnow)

    product = relationship("Product", back_populates="forecasts")
    business = relationship("Business", back_populates="forecasts")


class ChurnPrediction(Base):
    __tablename__ = "churn_predictions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    churn_probability = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    recommendation = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=dt.datetime.utcnow)

    customer = relationship("Customer", back_populates="churn_predictions")


class ProductRecommendation(Base):
    __tablename__ = "product_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    recommendation_type = Column(String, nullable=True)  # cross_sell, upsell
    score = Column(Float, nullable=True)
    generated_at = Column(DateTime, default=dt.datetime.utcnow)

    customer = relationship("Customer", back_populates="recommendations")
    product = relationship("Product", back_populates="recommendations")
