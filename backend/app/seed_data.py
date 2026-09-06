import json
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
            # Emails are globally unique, and "{slug}{id}" concatenation can
            # collide across businesses (e.g. business 2's "sales2"+2 ==
            # business 22's "sales"+22 == sales22@marketmind.ai). Fall back to
            # a suffix until the address is actually free.
            base = f"{slug}{business.id}"
            email = f"{base}@marketmind.ai"
            n = 2
            while (
                db.query(models.User)
                .filter(models.User.email == email)
                .count()
            ):
                email = f"{base}-{n}@marketmind.ai"
                n += 1
            db.add(
                models.User(
                    full_name=full_name,
                    email=email,
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


# Realistic device/IP/location fingerprints for seeded activity entries. The
# coordinates feed the "Login Locations" map on the Audit Trail page.
_LOGIN_DEVICES = [
    ("Chrome · Windows · Desktop", "103.108.44.210", "Hyderabad", 17.3850, 78.4867),
    ("Chrome · Android · Mobile", "103.217.155.44", "Bengaluru", 12.9716, 77.5946),
    ("Safari · macOS · Desktop", "49.207.53.118", "Mumbai", 19.0760, 72.8777),
    ("Chrome · Windows · Desktop", "106.51.220.16", "Chennai", 13.0827, 80.2707),
    ("Firefox · Linux · Desktop", "43.241.140.70", "Pune", 18.5204, 73.8567),
    ("Safari · iOS · Mobile", "115.99.26.141", "Delhi", 28.6139, 77.2090),
    # This fingerprint is only used for the seeded "suspicious" login.
    ("Chrome · Windows · Desktop", "45.119.54.88", "Kolkata", 22.5726, 88.3639),
]

# (days_ago, hour, minute, kind) — one realistic workday pattern per slot.
# Relative to "now" so the stats (Today / This Week / This Month) stay alive.
_ACTIVITY_SCHEDULE = [
    (6, 9, 12, "login"),
    (6, 10, 5, "create_sale"),
    (6, 12, 40, "update_inventory"),
    (5, 9, 30, "login"),
    (5, 11, 20, "create_customer"),
    (5, 15, 10, "create_invoice"),
    (4, 10, 45, "update_product"),
    (4, 14, 30, "create_sale"),
    (3, 9, 15, "login"),
    (3, 13, 5, "mark_paid"),
    (2, 10, 25, "upload_dataset"),
    (2, 16, 50, "update_inventory"),
    (1, 9, 40, "login"),
    (1, 12, 15, "create_sale"),
    (1, 17, 30, "resolve_alert"),
    (0, 9, 5, "login"),
    (0, 11, 45, "create_invoice"),
    (0, 15, 20, "create_sale"),
]


def seed_activity_logs(db: Session, business: models.Business):
    """Backfill realistic audit-log entries attributed to the business's
    team members, so the Activity Log page shows more than just the owner.

    Idempotent: only users who have zero audit entries so far get seeded
    logs, so repeated startups never duplicate anything. Logins carry
    device/location coordinates (which feed the Audit Trail login map) and
    one login per user is flagged suspicious, mirroring the app's own
    new-device detection.
    """
    db.flush()
    users = (
        db.query(models.User)
        .filter(models.User.business_id == business.id)
        .all()
    )
    user_ids_with_logs = {
        r[0]
        for r in (
            db.query(models.AuditLog.user_id)
            .filter(models.AuditLog.business_id == business.id)
            .all()
        )
        if r[0]
    }
    candidates = [u for u in users if u.id not in user_ids_with_logs]

    products = (
        db.query(models.Product)
        .filter(models.Product.business_id == business.id)
        .all()
    )
    customers = (
        db.query(models.Customer)
        .filter(models.Customer.business_id == business.id)
        .all()
    )
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.business_id == business.id)
        .all()
    )
    sales = (
        db.query(models.Sale)
        .filter(models.Sale.business_id == business.id)
        .all()
    )

    # Deterministic per business (seed_data already seeds random.seed(42)).
    rng = random.Random(f"activity-{business.id}")

    def _pick(items):
        return rng.choice(items) if items else None

    def _when(days_ago, hour, minute):
        now = dt.datetime.utcnow()
        day = now - dt.timedelta(days=days_ago)
        when = day.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return min(when, now - dt.timedelta(minutes=5))

    entries = []
    for idx, user in enumerate(candidates):
        # Each team member gets a consecutive slice of the schedule (~6
        # entries, wrapped for large teams).
        start = (idx * 6) % len(_ACTIVITY_SCHEDULE)
        slots = [_ACTIVITY_SCHEDULE[(start + k) % len(_ACTIVITY_SCHEDULE)] for k in range(6)]
        login_used = 0
        for days_ago, hour, minute, kind in slots:
            when = _when(days_ago, hour, minute)

            # Default every slot to a login entry; non-login kinds below
            # rewrite the fields they need.
            device, ip, location, lat, lng = _LOGIN_DEVICES[
                (idx + login_used) % (len(_LOGIN_DEVICES) - 1)
            ]
            login_used += 1
            entry = models.AuditLog(
                business_id=business.id,
                user_id=user.id,
                user_name=user.full_name,
                action="Logged in",
                action_type="login",
                resource="Auth",
                ip_address=ip,
                device=device,
                location=location,
                latitude=lat,
                longitude=lng,
                details=f"Login via email: {user.email}",
                created_at=when,
            )

            product = _pick(products)
            customer = _pick(customers)
            invoice = _pick(invoices)
            sale = _pick(sales)

            if kind == "create_sale" and sale and product and customer:
                entry.action, entry.action_type = "create_sale", "create"
                entry.resource, entry.resource_id = "sale", sale.id
                entry.device = None
                entry.details = (
                    f"Recorded sale #{sale.id}: {sale.quantity} × {product.name} "
                    f"(₹{sale.total_amount:,.0f}) for {customer.name}"
                )
            elif kind == "update_inventory" and product:
                qty = rng.randint(1, 20)
                entry.action, entry.action_type = "update_inventory", "update"
                entry.resource, entry.resource_id = "inventory", product.id
                entry.device = None
                entry.details = (
                    f"Adjusted stock for {product.name} ({'-' if rng.random() < 0.5 else '+'}{qty} units)"
                )
            elif kind == "create_customer" and customer:
                entry.action, entry.action_type = "create_customer", "create"
                entry.resource, entry.resource_id = "customer", customer.id
                entry.device = None
                entry.details = f"Added new customer {customer.name}"
            elif kind == "create_invoice" and invoice and customer:
                entry.action, entry.action_type = "create_invoice", "create"
                entry.resource, entry.resource_id = "invoice", invoice.id
                entry.device = None
                entry.details = f"Generated invoice {invoice.invoice_number} for {customer.name}"
            elif kind == "update_product" and product:
                entry.action, entry.action_type = "update_product", "update"
                entry.resource, entry.resource_id = "product", product.id
                entry.device = None
                entry.details = f"Updated price for {product.name} to ₹{product.price:,.0f}"
            elif kind == "mark_paid" and invoice:
                entry.action, entry.action_type = "mark_paid", "update"
                entry.resource, entry.resource_id = "invoice", invoice.id
                entry.device = None
                entry.details = f"Marked invoice {invoice.invoice_number} as paid (₹{invoice.amount:,.2f})"
            elif kind == "upload_dataset":
                entry.action, entry.action_type = "upload_dataset", "create"
                entry.resource = "dataset"
                entry.device = None
                month = when.strftime("%B").lower()
                entry.details = f"Uploaded sales_data_{month}.csv ({rng.randint(150, 400)} records)"
            elif kind == "resolve_alert" and product:
                entry.action, entry.action_type = "resolve_alert", "update"
                entry.resource, entry.resource_id = "inventory", product.id
                entry.device = None
                entry.details = f"Resolved low-stock alert for {product.name}"
            elif kind != "login":
                continue  # slot kind needs data this business doesn't have

            entries.append(entry)

        # One early login per user comes from an unknown device/city and is
        # flagged, mirroring the app's own new-device detection.
        user_logins = [
            e for e in entries if e.user_id == user.id and e.action_type == "login"
        ]
        if user_logins:
            flagged = next(
                (e for e in user_logins if e.created_at == _when(3, 9, 15)),
                user_logins[0],
            )
            d, ip2, loc2, la2, lo2 = _LOGIN_DEVICES[-1]
            flagged.device, flagged.ip_address = d, ip2
            flagged.location, flagged.latitude, flagged.longitude = loc2, la2, lo2
            flagged.is_suspicious = True
            flagged.suspicion_reason = "new device and new location"

    # Businesses whose users already had Local-only entries (e.g. the demo
    # team that logged in from this machine) get a few mapped logins so the
    # Audit Trail "Login Locations" map isn't empty. Idempotent: only runs
    # when the business has no geolocatable login at all.
    has_mapped = (
        db.query(models.AuditLog.id)
        .filter(
            models.AuditLog.business_id == business.id,
            models.AuditLog.latitude.isnot(None),
            models.AuditLog.longitude.isnot(None),
        )
        .first()
    )
    if not has_mapped and users:
        for k, u in enumerate(users[:3]):
            device, ip, loc, lat, lng = _LOGIN_DEVICES[(k + 2) % (len(_LOGIN_DEVICES) - 1)]
            entries.append(
                models.AuditLog(
                    business_id=business.id,
                    user_id=u.id,
                    user_name=u.full_name,
                    action="Logged in",
                    action_type="login",
                    resource="Auth",
                    ip_address=ip,
                    device=device,
                    location=loc,
                    latitude=lat,
                    longitude=lng,
                    details=f"Login via email: {u.email}",
                    created_at=_when(5 - k, 10, 30),
                )
            )

    if entries:
        db.add_all(entries)
        db.commit()


# Demo rows for the Scheduled Reports / Dashboard Builder / Report Templates
# pages — the tables start empty and these make the pages presentable.
_DEMO_SCHEDULED_REPORTS = [
    ("sales-summary", "daily", "pdf"),
    ("inventory-status", "weekly", "excel"),
    ("executive-dashboard", "monthly", "pdf"),
]

_DEMO_LAYOUT_EXECUTIVE = [
    {"i": "kpi_revenue", "x": 0, "y": 0, "w": 3, "h": 2},
    {"i": "kpi_sales", "x": 3, "y": 0, "w": 3, "h": 2},
    {"i": "kpi_customers", "x": 6, "y": 0, "w": 3, "h": 2},
    {"i": "kpi_avg_order", "x": 9, "y": 0, "w": 3, "h": 2},
    {"i": "chart_revenue", "x": 0, "y": 2, "w": 8, "h": 4},
    {"i": "chart_products", "x": 8, "y": 2, "w": 4, "h": 4},
    {"i": "table_sales", "x": 0, "y": 6, "w": 6, "h": 4},
    {"i": "table_top_customers", "x": 6, "y": 6, "w": 6, "h": 4},
]

_DEMO_LAYOUT_SALES = [
    {"i": "kpi_revenue", "x": 0, "y": 0, "w": 4, "h": 2},
    {"i": "kpi_sales", "x": 4, "y": 0, "w": 4, "h": 2},
    {"i": "kpi_lowstock", "x": 8, "y": 0, "w": 4, "h": 2},
    {"i": "chart_sales_area", "x": 0, "y": 2, "w": 8, "h": 4},
    {"i": "chart_category", "x": 8, "y": 2, "w": 4, "h": 4},
    {"i": "table_activity", "x": 0, "y": 6, "w": 12, "h": 4},
]

_DEMO_REPORT_TEMPLATES = [
    ("Daily Sales Brief", "Key sales KPIs, top products and recent transactions.",
     ["kpi_cards", "top_products", "sales_by_date", "recent_sales"]),
    ("Inventory Health Check", "Stock levels, low-stock alerts and category breakdown.",
     ["kpi_cards", "low_stock_alerts", "product_list", "category_breakdown"]),
    ("Customer Value Report", "Customer segments, top customers and lifetime value.",
     ["kpi_cards", "segment_breakdown", "top_customers", "clv_analysis"]),
]


def seed_user_data(db: Session, business: models.Business):
    """Seed demo scheduled reports, dashboard layouts and report templates so
    the Reports pages aren't empty. Idempotent: only seeds what the business
    is still missing."""
    db.flush()
    team_emails = [
        e
        for (e,) in (
            db.query(models.User.email)
            .filter(models.User.business_id == business.id)
            .all()
        )
    ][:4]

    if (
        db.query(models.ScheduledReport)
        .filter(models.ScheduledReport.business_id == business.id)
        .count()
        == 0
    ):
        for i, (rtype, freq, fmt) in enumerate(_DEMO_SCHEDULED_REPORTS):
            db.add(
                models.ScheduledReport(
                    business_id=business.id,
                    report_type=rtype,
                    frequency=freq,
                    format=fmt,
                    recipients=json.dumps(team_emails),
                    enabled=(i != 1),
                    last_run=dt.datetime.utcnow() - dt.timedelta(days=1 + i),
                )
            )

    if (
        db.query(models.DashboardLayout)
        .filter(models.DashboardLayout.business_id == business.id)
        .count()
        == 0
    ):
        db.add(
            models.DashboardLayout(
                business_id=business.id,
                name="Executive Overview",
                layout_json=json.dumps(_DEMO_LAYOUT_EXECUTIVE),
                is_active=True,
            )
        )
        db.add(
            models.DashboardLayout(
                business_id=business.id,
                name="Sales Focus",
                layout_json=json.dumps(_DEMO_LAYOUT_SALES),
                is_active=False,
            )
        )

    if (
        db.query(models.CustomReportTemplate)
        .filter(models.CustomReportTemplate.business_id == business.id)
        .count()
        == 0
    ):
        for name, desc, sections in _DEMO_REPORT_TEMPLATES:
            db.add(
                models.CustomReportTemplate(
                    business_id=business.id,
                    name=name,
                    description=desc,
                    sections=json.dumps(sections),
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

    # 2. For EVERY business (not just the demo one): backfill demo data and
    #    team activity. Both functions are idempotent — they only add what the
    #    business is still missing — so restarts never duplicate anything.
    for biz in db.query(models.Business).all():
        seed_business_demo_data(db, biz)
        seed_activity_logs(db, biz)
        seed_user_data(db, biz)


if __name__ == "__main__":
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_if_empty(db)
        print("Database seeded successfully!")
    finally:
        db.close()
