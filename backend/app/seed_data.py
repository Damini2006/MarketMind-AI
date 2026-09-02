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

DEMO_CATEGORIES = [
    "Grocery",
    "Beverages",
    "Personal Care",
    "Home & Electronics",
    "Stationery",
]

DEMO_SUPPLIERS = [
    ("Krishna Distributors", "9876543210", "sales@krishnadistributors.in", "Hyderabad"),
    ("Sunrise Agro Foods", "9876501234", "orders@sunriseagro.in", "Vijayawada"),
    ("Mehta Electronics", "9866112233", "contact@mehtaelectronics.in", "Chennai"),
    ("GreenLeaf Organics", "9845012345", "hello@greenleaforganics.in", "Bengaluru"),
]

# (full_name, role, email slug) — emails are made unique per business below
DEMO_TEAM = [
    ("Vikram Shetty", models.RoleEnum.store_manager, "manager"),
    ("Priya Nair", models.RoleEnum.sales_executive, "sales"),
    ("Arjun Rao", models.RoleEnum.sales_executive, "sales2"),
]


def seed_business_demo_data(db: Session, business: models.Business):
    """Seed demo data (categories, suppliers, team, products, customers, sales,
    invoices) for a single business.

    Safe to call repeatedly: only seeds what the business is still missing, so a
    business that already has records is left untouched.
    """
    # 0. Categories
    if db.query(models.Category).filter(models.Category.business_id == business.id).count() == 0:
        for cat in DEMO_CATEGORIES:
            db.add(models.Category(category_name=cat, business_id=business.id))

    # 1. Suppliers
    if db.query(models.Supplier).filter(models.Supplier.business_id == business.id).count() == 0:
        for name, phone, email, address in DEMO_SUPPLIERS:
            db.add(
                models.Supplier(
                    supplier_name=name,
                    phone=phone,
                    email=email,
                    address=address,
                    business_id=business.id,
                )
            )

    # 2. Team members — only when the business has at most its owner (no team yet)
    db.flush()  # make pending users (e.g. seeded demo users) visible to the count
    user_count = (
        db.query(models.User)
        .filter(models.User.business_id == business.id)
        .count()
    )
    if user_count <= 1:
        for full_name, role, slug in DEMO_TEAM:
            db.add(
                models.User(
                    full_name=full_name,
                    email=f"{slug}{business.id}@marketmind.ai",
                    hashed_password=hash_password("Demo@123"),
                    role=role,
                    business_id=business.id,
                )
            )

    # 3. Products
    products = (
        db.query(models.Product)
        .filter(models.Product.business_id == business.id)
        .all()
    )
    if not products:
        for name, category, price in PRODUCT_CATALOG:
            p = models.Product(
                name=name,
                category=category,
                price=price,
                stock_quantity=random.randint(0, 150),
                reorder_threshold=20,
                warehouse_location=random.choice(["Warehouse A", "Warehouse B", "Warehouse C"]),
                business_id=business.id,
            )
            db.add(p)
            products.append(p)
        db.flush()
        # Normalized inventory ledger rows (pre-dev parity)
        for p in products:
            db.add(
                models.Inventory(
                    product_id=p.id,
                    quantity_available=p.stock_quantity,
                    reorder_level=p.reorder_threshold,
                    warehouse_location=p.warehouse_location,
                )
            )
        db.flush()

    # 3b. Inventory ledger backfill (pre-dev parity): ensure every product of
    #     the business has an inventory mirror row — idempotent, so it also
    #     covers businesses/products created before this schema existed.
    for p in products:
        has_inv = (
            db.query(models.Inventory)
            .filter(models.Inventory.product_id == p.id)
            .count()
            > 0
        )
        if not has_inv:
            db.add(
                models.Inventory(
                    product_id=p.id,
                    quantity_available=p.stock_quantity,
                    reorder_level=p.reorder_threshold,
                    warehouse_location=p.warehouse_location,
                )
            )
    db.flush()

    # 4. Customers
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == business.id)
        .all()
    )
    if not customers:
        for name in CUSTOMER_NAMES:
            c = models.Customer(
                name=name,
                email=f"{name.split()[0].lower()}@example.com",
                phone=f"9{random.randint(100000000, 999999999)}",
                business_id=business.id,
            )
            db.add(c)
            customers.append(c)
        db.flush()

    # 5. Sales history (only if the business has products, customers and no sales yet)
    has_sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == business.id)
        .count()
        > 0
    )
    if not has_sales and products and customers:
        # A few customers lapse partway through the period so the churn model
        # and at-risk segmentation have real signal to learn from.
        lapsed = set(random.sample(customers, min(3, len(customers))))
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
                # Lapsed customers stop purchasing after ~40 days
                if customer in lapsed and day_offset >= 40:
                    continue
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
                    business_id=business.id,
                )
                db.add(sale)

        # Ensure every non-lapsed customer has recent purchases (last 10 days)
        # so the churn model has enough non-churned labels for cross-validation.
        active_customers = [c for c in customers if c not in lapsed]
        for c in active_customers:
            for _ in range(random.randint(2, 4)):
                product = random.choice(products)
                recent_day = random.randint(110, 119)
                qty = max(1, int(random.gauss(3, 2)))
                sale = models.Sale(
                    customer_id=c.id,
                    product_id=product.id,
                    quantity=qty,
                    unit_price=product.price,
                    total_amount=qty * product.price,
                    sale_date=(start_date + dt.timedelta(days=recent_day)).replace(
                        hour=random.randint(9, 20), minute=random.randint(0, 59)
                    ),
                    source="seed",
                    business_id=business.id,
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
                business_id=business.id,
            )
            db.add(sale)

    # 5b. Sale line items (pre-dev parity): one row per seeded sale. Only
    #     runs when the seed actually created sales, so it is idempotent.
    seeded_sales = (
        db.query(models.Sale)
        .filter(
            models.Sale.business_id == business.id,
            models.Sale.source == "seed",
        )
        .all()
    )
    if seeded_sales:
        sale_ids = [s.id for s in seeded_sales]
        has_items = (
            db.query(models.SaleItem)
            .filter(models.SaleItem.sale_id.in_(sale_ids))
            .count()
            > 0
        )
        if not has_items:
            for s in seeded_sales:
                db.add(
                    models.SaleItem(
                        sale_id=s.id,
                        product_id=s.product_id,
                        quantity=s.quantity,
                        unit_price=s.unit_price,
                        total=s.total_amount,
                    )
                )
            db.flush()

    # 6. Datasets (one demo import record so the Datasets page isn't empty)
    has_datasets = (
        db.query(models.UploadedDataset)
        .filter(models.UploadedDataset.business_id == business.id)
        .count()
        > 0
    )
    if not has_datasets:
        owner = (
            db.query(models.User)
            .filter(models.User.business_id == business.id)
            .order_by(models.User.id)
            .first()
        )
        db.add(
            models.UploadedDataset(
                file_name="demo_sales_history.csv",
                validation_status="valid",
                total_records=640,
                valid_records=632,
                invalid_records=8,
                uploaded_by=owner.id if owner else None,
                business_id=business.id,
            )
        )

    # 7. Invoices (only if the business has customers and no invoices yet)
    has_invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.business_id == business.id)
        .count()
        > 0
    )
    if not has_invoices and customers:
        for i in range(15):
            customer = random.choice(customers)
            status = random.choice(["pending", "paid", "paid", "overdue"])
            due = dt.datetime.utcnow() + dt.timedelta(days=random.randint(-10, 20))
            db.add(
                models.Invoice(
                    customer_id=customer.id,
                    invoice_number=f"INV-SEED-{business.id:03d}-{i:04d}",
                    amount=round(random.uniform(500, 8000), 2),
                    status=status,
                    due_date=due,
                    business_id=business.id,
                )
            )

    db.commit()


def seed_if_empty(db: Session):
    # 0. Ensure a demo business exists (multi-tenant). All seeded data belongs to it.
    business = db.query(models.Business).first()
    if business is None:
        business = models.Business(company_name="Mega Mart")
        db.add(business)
        db.flush()

    # 1. Seed demo users if no users exist
    if db.query(models.User).count() == 0:
        for name, email, password, role in DEMO_USERS:
            db.add(
                models.User(
                    full_name=name,
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    business_id=business.id,
                )
            )

    # 2. Seed demo products/customers/sales/invoices for the demo business
    seed_business_demo_data(db, business)


if __name__ == "__main__":
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_if_empty(db)
        print("Database seeded successfully!")
    finally:
        db.close()
