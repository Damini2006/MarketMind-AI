import random
import datetime as dt
from sqlalchemy.orm import Session

from . import models
from .core.security import hash_password
random.seed(42)

DEMO_USERS_BUSINESS_1 = [
    ("Asha Rao", "owner@marketmind.ai", "Owner@123", "business_owner"),
    ("Vikram Shetty", "manager@marketmind.ai", "Manager@123", "store_manager"),
    ("Priya Nair", "sales@marketmind.ai", "Sales@123", "sales_executive"),
]

DEMO_USERS_BUSINESS_2 = [
    ("Rahul Jain", "rahul@techstore.ai", "Tech@123", "business_owner"),
]

ROLES = [
    ("business_owner", "Business Owner with full access"),
    ("store_manager", "Store Manager with inventory and sales access"),
    ("sales_executive", "Sales Executive with sales access"),
    ("admin", "System Administrator"),
]

def seed_if_empty(db: Session):
    if db.query(models.Business).count() > 0:
        return  # already seeded

    # Seed Roles
    db_roles = {}
    for r_name, r_desc in ROLES:
        role = models.Role(role_name=r_name, description=r_desc)
        db.add(role)
        db_roles[r_name] = role
    db.flush()

    # Seed Businesses
    b1 = models.Business(company_name="Mega Mart")
    b2 = models.Business(company_name="Tech Store")
    db.add_all([b1, b2])
    db.flush()

    # Seed Users for B1
    for full_name, email, password, role_name in DEMO_USERS_BUSINESS_1:
        db.add(models.User(
            full_name=full_name, email=email, 
            hashed_password=hash_password(password), role_id=db_roles[role_name].id,
            business_id=b1.id
        ))
        
    # Seed Users for B2
    for full_name, email, password, role_name in DEMO_USERS_BUSINESS_2:
        db.add(models.User(
            full_name=full_name, email=email, 
            hashed_password=hash_password(password), role_id=db_roles[role_name].id,
            business_id=b2.id
        ))
        
    # Admin
    db.add(models.User(
        full_name="System Admin", email="admin@marketmind.ai", 
        hashed_password=hash_password("Admin@123"), role_id=db_roles["admin"].id,
        business_id=b1.id
    ))
    db.flush()

    # B1 DATA
    cat_b1 = models.Category(category_name="Grocery", business_id=b1.id)
    db.add(cat_b1)
    db.flush()
    
    sup_b1 = models.Supplier(supplier_name="Fresh Foods", business_id=b1.id)
    db.add(sup_b1)
    db.flush()
    
    prod_b1 = models.Product(name="Organic Rice", category_id=cat_b1.id, supplier_id=sup_b1.id, selling_price=50.0, business_id=b1.id)
    db.add(prod_b1)
    db.flush()
    
    db.add(models.Inventory(product_id=prod_b1.id, quantity_available=100, reorder_level=20))
    
    cust_b1 = models.Customer(full_name="Ramesh Kumar", business_id=b1.id)
    db.add(cust_b1)
    db.flush()
    
    sale_b1 = models.Sale(business_id=b1.id, customer_id=cust_b1.id, total_amount=100.0)
    db.add(sale_b1)
    db.flush()
    db.add(models.SaleItem(sale_id=sale_b1.id, product_id=prod_b1.id, quantity=2, unit_price=50.0, total=100.0))

    # B2 DATA
    cat_b2 = models.Category(category_name="Electronics", business_id=b2.id)
    db.add(cat_b2)
    db.flush()
    
    sup_b2 = models.Supplier(supplier_name="Tech Parts Inc", business_id=b2.id)
    db.add(sup_b2)
    db.flush()
    
    prod_b2 = models.Product(name="USB-C Cable", category_id=cat_b2.id, supplier_id=sup_b2.id, selling_price=15.0, business_id=b2.id)
    db.add(prod_b2)
    db.flush()
    
    db.add(models.Inventory(product_id=prod_b2.id, quantity_available=500, reorder_level=50))
    
    cust_b2 = models.Customer(full_name="Alice Smith", business_id=b2.id)
    db.add(cust_b2)
    db.flush()
    
    sale_b2 = models.Sale(business_id=b2.id, customer_id=cust_b2.id, total_amount=30.0)
    db.add(sale_b2)
    db.flush()
    db.add(models.SaleItem(sale_id=sale_b2.id, product_id=prod_b2.id, quantity=2, unit_price=15.0, total=30.0))

    db.commit()
