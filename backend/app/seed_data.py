import random
import datetime as dt
from sqlalchemy.orm import Session

from . import models
from .core.security import hash_password

random.seed(42)

DEMO_USERS = [
    ("Asha Rao", "owner@marketmind.ai", "Owner@123", models.RoleEnum.business_owner),
    ("Vikram Shetty", "manager@marketmind.ai", "Manager@123", models.RoleEnum.store_manager),
    ("Priya Nair", "sales@marketmind.ai", "Sales@123", models.RoleEnum.sales_executive),
    ("System Admin", "admin@marketmind.ai", "Admin@123", models.RoleEnum.admin),
]

PRODUCT_CATALOG = [
    ("Organic Basmati Rice 5kg", "Grocery", 650),
    ("Cold-Pressed Sunflower Oil 1L", "Grocery", 210),
    ("Whole Wheat Atta 10kg", "Grocery", 480),
    ("Assam Black Tea 500g", "Beverages", 190),
    ("Filter Coffee Powder 500g", "Beverages", 260),
    ("Toor Dal 1kg", "Grocery", 145),
    ("Herbal Shampoo 340ml", "Personal Care", 320),
    ("Ayurvedic Soap Pack of 4", "Personal Care", 180),
    ("LED Bulb 9W", "Home & Electronics", 120),
    ("Non-stick Frying Pan", "Home & Electronics", 899),
    ("Stainless Steel Water Bottle", "Home & Electronics", 350),
    ("Notebook Set of 5", "Stationery", 150),
]

CUSTOMER_NAMES = [
    "Ramesh Kumar", "Sunita Patil", "Arjun Mehta", "Fatima Sheikh", "Deepak Verma",
    "Kavya Iyer", "Rohit Sharma", "Anjali Gupta", "Suresh Reddy", "Meera Joshi",
    "Karan Malhotra", "Divya Pillai", "Naveen Kumar", "Pooja Bansal", "Vivek Nair",
    "Shreya Desai", "Manoj Tiwari", "Ritu Chawla", "Ajay Singh", "Neha Kulkarni",
]


def seed_if_empty(db: Session):
    # 1. Seed demo users if no users exist
    if db.query(models.User).count() == 0:
        for name, email, password, role in DEMO_USERS:
            db.add(models.User(full_name=name, email=email, hashed_password=hash_password(password), role=role))

    # 2. Seed product catalog if empty
    products = []
    if db.query(models.Product).count() == 0:
        for name, category, price in PRODUCT_CATALOG:
            p = models.Product(
                name=name,
                category=category,
                price=price,
                stock_quantity=random.randint(0, 150),
                reorder_threshold=20,
                warehouse_location=random.choice(["Warehouse A", "Warehouse B", "Warehouse C"]),
            )
            db.add(p)
            products.append(p)
        db.flush()
    else:
        products = db.query(models.Product).all()

    # 3. Seed customer directory if empty
    customers = []
    if db.query(models.Customer).count() == 0:
        for name in CUSTOMER_NAMES:
            c = models.Customer(
                name=name,
                email=f"{name.split()[0].lower()}@example.com",
                phone=f"9{random.randint(100000000, 999999999)}"
            )
            db.add(c)
            customers.append(c)
        db.flush()
    else:
        customers = db.query(models.Customer).all()

    # 4. Seed 120 days of sales history if empty
    if db.query(models.Sale).count() == 0:
        start_date = dt.datetime.utcnow() - dt.timedelta(days=120)
        for day_offset in range(120):
            current_date = start_date + dt.timedelta(days=day_offset)
            num_sales_today = random.randint(2, 8)
            
            # Upward trend + weekly seasonality
            trend_multiplier = 1 + (day_offset / 120) * 0.4
            weekday_multiplier = 1.3 if current_date.weekday() in (4, 5) else 1.0

            for _ in range(num_sales_today):
                product = random.choice(products)
                customer = random.choice(customers)
                qty = max(1, int(random.gauss(3, 2) * trend_multiplier * weekday_multiplier))
                
                sale = models.Sale(
                    customer_id=customer.id,
                    product_id=product.id,
                    quantity=qty,
                    unit_price=product.price,
                    total_amount=qty * product.price,
                    sale_date=current_date.replace(
                        hour=random.randint(9, 20),
                        minute=random.randint(0, 59)
                    ),
                    source="seed",
                )
                db.add(sale)

        # Inject outlier sales transactions for Anomaly Detection
        for _ in range(4):
            product = random.choice(products)
            customer = random.choice(customers)
            sale = models.Sale(
                customer_id=customer.id,
                product_id=product.id,
                quantity=random.randint(80, 150),
                unit_price=product.price,
                total_amount=random.randint(80, 150) * product.price,
                sale_date=start_date + dt.timedelta(
                    days=random.randint(0, 119),
                    hours=random.choice([2, 3, 4])
                ),
                source="seed",
            )
            db.add(sale)

    # 5. Seed invoices if empty
    if db.query(models.Invoice).count() == 0:
        for i in range(15):
            customer = random.choice(customers)
            status = random.choice(["pending", "paid", "paid", "overdue"])
            due = dt.datetime.utcnow() + dt.timedelta(days=random.randint(-10, 20))
            db.add(
                models.Invoice(
                    customer_id=customer.id,
                    invoice_number=f"INV-SEED-{i:04d}",
                    amount=round(random.uniform(500, 8000), 2),
                    status=status,
                    due_date=due,
                )
            )

    db.commit()


if __name__ == "__main__":
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_if_empty(db)
        print("Database seeded successfully!")
    finally:
        db.close()