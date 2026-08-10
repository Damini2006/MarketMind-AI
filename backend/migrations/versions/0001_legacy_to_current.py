"""0001 — Upgrade the legacy Neon schema to the current models.

The Neon database that predates this project's multi-tenant / ML iteration used
a different schema: a ``roles`` table with ``users.role_id``, ``sale_items``
for line items, ``products.selling_price`` / ``category_id``, ``inventory`` for
stock, ``customers.full_name``, and several analytics tables the current app
regenerates itself (forecasts, churn_predictions, ...).

This revision transforms that schema in place to match the SQLAlchemy models in
``app/models.py``, backfilling real data:

- ``users.role``      ← ``roles.role_name`` (values already match RoleEnum)
- ``customers.name``  ← ``customers.full_name``
- ``products.category`` ← ``categories.category_name`` via ``category_id``
- ``products.price``  ← ``products.selling_price``
- ``products.stock_quantity / reorder_threshold / warehouse_location``
                      ← ``inventory`` (one row per product)
- ``sales``           ← rebuilt one row per ``sale_items`` line (a legacy sale
                        with several items becomes several sales rows), keeping
                        customer / date / business and per-line totals

It is defensive: if the database is already current (no ``roles`` table and no
``users.role_id``), every step is skipped, so a fresh or already-migrated
database is a no-op. PostgreSQL DDL is transactional, so a failure mid-revision
rolls back everything.

Revision ID: 0001_legacy_to_current
Revises:
Create Date: 2026-08-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0001_legacy_to_current"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables owned by the legacy iteration that the current app does not use
LEGACY_TABLES = [
    "alerts",
    "anomalies",
    "churn_predictions",
    "customer_segments",
    "forecasts",
    "inventory",
    "inventory_transactions",
    "product_recommendations",
    "roles",
    "sale_items",
]

# Legacy columns that are replaced or no longer used, per table
USERS_DROP_COLUMNS = ["role_id", "profile_image", "last_login", "updated_at"]
CUSTOMERS_DROP_COLUMNS = [
    "full_name", "gender", "dob", "address",
    "total_orders", "total_spent", "last_purchase_date",
]
PRODUCTS_DROP_COLUMNS = [
    "category_id", "supplier_id", "sku", "barcode", "purchase_price",
    "selling_price", "description", "image_url", "is_active", "created_at",
]
SALES_DROP_COLUMNS = [
    "invoice_number", "user_id", "subtotal", "tax",
    "discount", "payment_status", "payment_method",
]
INVOICES_DROP_COLUMNS = ["sale_id", "payment_date", "invoice_status", "pdf_url"]


def _table_names(bind) -> set:
    return set(inspect(bind).get_table_names())


def _columns(bind, table: str) -> set:
    if table not in _table_names(bind):
        return set()
    return {c["name"] for c in inspect(bind).get_columns(table)}


def _is_legacy(bind) -> bool:
    """True when the database still has the old pre-multi-tenant schema."""
    tables = _table_names(bind)
    if "roles" in tables:
        return True
    if "users" in tables:
        return "role_id" in _columns(bind, "users")
    return False


def upgrade() -> None:
    bind = op.get_bind()

    if not _is_legacy(bind):
        print("[migrate] Schema already current — legacy transform skipped.")
        return

    # --- Shared enum type used by users.role -------------------------------
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE roleenum AS ENUM "
        "('business_owner','store_manager','sales_executive','admin'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )

    # --- users -------------------------------------------------------------
    if "role" not in _columns(bind, "users"):
        op.execute("ALTER TABLE users ADD COLUMN role roleenum")
        op.execute(
            "UPDATE users SET role = COALESCE("
            "  (SELECT role_name::roleenum FROM roles WHERE roles.id = users.role_id),"
            "  'sales_executive'::roleenum)"
        )
        op.execute("ALTER TABLE users ALTER COLUMN role SET NOT NULL")
    for col, ddl in [
        ("reset_otp", "VARCHAR"),
        ("reset_otp_expiry", "TIMESTAMP WITHOUT TIME ZONE"),
        ("preferred_currency", "VARCHAR DEFAULT 'INR'"),
        ("timezone", "VARCHAR DEFAULT 'Asia/Kolkata'"),
        ("avatar_color", "VARCHAR"),
        ("avatar_url", "VARCHAR"),
        ("bio", "TEXT"),
    ]:
        if col not in _columns(bind, "users"):
            op.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")

    # Old profile_image (all NULL in the legacy data) maps onto avatar_url
    op.execute(
        "UPDATE users SET avatar_url = profile_image "
        "WHERE profile_image IS NOT NULL AND avatar_url IS NULL"
    )

    # Ensure email uniqueness like the current model (skip if already unique)
    existing_uq = {c["name"] for c in inspect(bind).get_unique_constraints("users")}
    email_unique = any(
        ix.get("unique") and ix.get("column_names") == ["email"]
        for ix in inspect(bind).get_indexes("users")
    )
    if "uq_users_email" not in existing_uq and not email_unique:
        op.create_unique_constraint("uq_users_email", "users", ["email"])

    for col in USERS_DROP_COLUMNS:
        if col in _columns(bind, "users"):
            op.drop_column("users", col)

    # --- customers ---------------------------------------------------------
    if "name" not in _columns(bind, "customers"):
        op.add_column("customers", sa.Column("name", sa.String(), nullable=True))
        op.execute("UPDATE customers SET name = full_name")
        op.alter_column("customers", "name", existing_type=sa.String(), nullable=False)
    for col in CUSTOMERS_DROP_COLUMNS:
        if col in _columns(bind, "customers"):
            op.drop_column("customers", col)

    # --- products ----------------------------------------------------------
    for col, ddl in [
        ("category", "VARCHAR"),
        ("price", "FLOAT"),
        ("stock_quantity", "INTEGER DEFAULT 0"),
        ("reorder_threshold", "INTEGER DEFAULT 10"),
        ("warehouse_location", "VARCHAR"),
    ]:
        if col not in _columns(bind, "products"):
            op.execute(f"ALTER TABLE products ADD COLUMN {col} {ddl}")

    if "inventory" in _table_names(bind):
        op.execute(
            "UPDATE products p SET "
            "  category = (SELECT c.category_name FROM categories c WHERE c.id = p.category_id),"
            "  price = COALESCE(p.selling_price, 0),"
            "  stock_quantity = COALESCE("
            "    (SELECT i.quantity_available FROM inventory i WHERE i.product_id = p.id), 0),"
            "  reorder_threshold = COALESCE("
            "    (SELECT i.reorder_level FROM inventory i WHERE i.product_id = p.id), 10),"
            "  warehouse_location = "
            "    (SELECT i.warehouse_location FROM inventory i WHERE i.product_id = p.id)"
        )
    else:
        op.execute("UPDATE products SET price = COALESCE(selling_price, 0)")
    op.alter_column("products", "price", existing_type=sa.Float(), nullable=False)
    for col in PRODUCTS_DROP_COLUMNS:
        if col in _columns(bind, "products"):
            op.drop_column("products", col)

    # --- sales: one row per legacy sale_item line --------------------------
    for col, ddl in [
        ("product_id", "INTEGER"),
        ("quantity", "INTEGER DEFAULT 1"),
        ("unit_price", "FLOAT"),
        ("source", "VARCHAR DEFAULT 'manual'"),
    ]:
        if col not in _columns(bind, "sales"):
            op.execute(f"ALTER TABLE sales ADD COLUMN {col} {ddl}")

    # Drop the legacy columns first: several (subtotal, tax, discount,
    # payment_status) are NOT NULL without defaults, which would reject the
    # rebuilt rows below.
    for col in SALES_DROP_COLUMNS:
        if col in _columns(bind, "sales"):
            op.drop_column("sales", col)

    if "sale_items" in _table_names(bind):
        op.execute("CREATE TEMP TABLE _legacy_sale_ids AS SELECT id FROM sales")
        op.execute(
            "INSERT INTO sales "
            "(customer_id, product_id, quantity, unit_price, total_amount, "
            " sale_date, source, business_id) "
            "SELECT s.customer_id, si.product_id,"
            "       COALESCE(si.quantity, 1),"
            "       COALESCE(si.unit_price, 0),"
            "       COALESCE(si.total, s.total_amount),"
            "       s.sale_date,"
            "       'migration',"
            "       s.business_id "
            "FROM sales s "
            "LEFT JOIN sale_items si ON si.sale_id = s.id"
        )
        # sale_items references the old sales rows — drop it before deleting them
        op.drop_table("sale_items")
        op.execute(
            "DELETE FROM sales WHERE id IN (SELECT id FROM _legacy_sale_ids)"
        )
        op.execute("DROP TABLE _legacy_sale_ids")

    # --- invoices ----------------------------------------------------------
    for col, ddl in [
        ("customer_id", "INTEGER"),
        ("amount", "FLOAT DEFAULT 0"),
        ("status", "VARCHAR DEFAULT 'pending'"),
    ]:
        if col not in _columns(bind, "invoices"):
            op.execute(f"ALTER TABLE invoices ADD COLUMN {col} {ddl}")
    for col in INVOICES_DROP_COLUMNS:
        if col in _columns(bind, "invoices"):
            op.drop_column("invoices", col)

    # --- drop tables the current app no longer uses -----------------------
    for table in LEGACY_TABLES:
        if table in _table_names(bind):
            op.drop_table(table)


def downgrade() -> None:
    """Best-effort reverse: restore the legacy schema shape.

    Data that was consolidated (e.g. sales rebuilt from sale_items, stock moved
    from inventory into products) is carried back where possible; the analytics
    tables the app regenerates (forecasts, churn_predictions, ...) are
    recreated empty. For a full restore of the original data, use a backup.
    """
    bind = op.get_bind()

    if _is_legacy(bind):
        print("[migrate] Already on legacy schema — nothing to downgrade.")
        return

    tables = _table_names(bind)

    # Recreate the roles table (needed by users.role_id backfill)
    if "roles" not in tables:
        op.create_table(
            "roles",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("role_name", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
        )
    op.execute(
        "INSERT INTO roles (role_name, description) VALUES "
        "('business_owner', 'Business Owner with full access'), "
        "('store_manager', 'Store Manager with inventory and sales access'), "
        "('sales_executive', 'Sales Executive with sales access'), "
        "('admin', 'System Administrator') "
        "ON CONFLICT (role_name) DO NOTHING"
    )

    # users: restore old columns, drop new ones
    if "role_id" not in _columns(bind, "users"):
        op.add_column("users", sa.Column("role_id", sa.Integer(), nullable=True))
        op.execute(
            "UPDATE users SET role_id = "
            "(SELECT id FROM roles WHERE roles.role_name = users.role::text)"
        )
    for col, ddl in [
        ("profile_image", "VARCHAR"),
        ("last_login", "TIMESTAMP WITHOUT TIME ZONE"),
        ("updated_at", "TIMESTAMP WITHOUT TIME ZONE"),
    ]:
        if col not in _columns(bind, "users"):
            op.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
    for col in ["role", "reset_otp", "reset_otp_expiry", "preferred_currency",
                "timezone", "avatar_color", "avatar_url", "bio"]:
        if col in _columns(bind, "users"):
            op.drop_column("users", col)

    # customers: restore full_name, drop name
    if "full_name" not in _columns(bind, "customers"):
        op.add_column("customers", sa.Column("full_name", sa.String(), nullable=True))
        op.execute("UPDATE customers SET full_name = name")
    for col in CUSTOMERS_DROP_COLUMNS:
        if col == "full_name":
            continue
        if col not in _columns(bind, "customers"):
            op.execute(f"ALTER TABLE customers ADD COLUMN {col} VARCHAR")
    if "name" in _columns(bind, "customers"):
        op.drop_column("customers", "name")

    # products: restore old columns, drop new ones
    for col, ddl in [
        ("category_id", "INTEGER"),
        ("supplier_id", "INTEGER"),
        ("sku", "VARCHAR"),
        ("barcode", "VARCHAR"),
        ("purchase_price", "FLOAT DEFAULT 0"),
        ("selling_price", "FLOAT"),
        ("description", "TEXT"),
        ("image_url", "VARCHAR"),
        ("is_active", "BOOLEAN DEFAULT true"),
        ("created_at", "TIMESTAMP WITHOUT TIME ZONE"),
    ]:
        if col not in _columns(bind, "products"):
            op.execute(f"ALTER TABLE products ADD COLUMN {col} {ddl}")
    op.execute(
        "UPDATE products p SET "
        "selling_price = p.price, purchase_price = p.price, "
        "category_id = (SELECT c.id FROM categories c WHERE c.category_name = p.category), "
        "is_active = true"
    )
    for col in ["category", "price", "stock_quantity", "reorder_threshold",
                "warehouse_location"]:
        if col in _columns(bind, "products"):
            op.drop_column("products", col)

    # sales: restore old columns, rebuild sale_items, drop new ones
    for col, ddl in [
        ("invoice_number", "VARCHAR"),
        ("user_id", "INTEGER"),
        ("subtotal", "FLOAT DEFAULT 0"),
        ("tax", "FLOAT DEFAULT 0"),
        ("discount", "FLOAT DEFAULT 0"),
        ("payment_status", "VARCHAR DEFAULT 'completed'"),
        ("payment_method", "VARCHAR"),
    ]:
        if col not in _columns(bind, "sales"):
            op.execute(f"ALTER TABLE sales ADD COLUMN {col} {ddl}")
    op.execute("UPDATE sales SET subtotal = total_amount")

    if "sale_items" not in tables:
        op.create_table(
            "sale_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("sale_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=True),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Float(), nullable=False, server_default="0"),
            sa.Column("discount", sa.Float(), nullable=False, server_default="0"),
            sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        )
    op.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) "
        "SELECT id, product_id, quantity, unit_price, total_amount FROM sales"
    )
    for col in ["product_id", "quantity", "unit_price", "source"]:
        if col in _columns(bind, "sales"):
            op.drop_column("sales", col)

    # invoices: restore old columns, drop new ones
    for col, ddl in [
        ("sale_id", "INTEGER"),
        ("payment_date", "TIMESTAMP WITHOUT TIME ZONE"),
        ("invoice_status", "VARCHAR"),
        ("pdf_url", "VARCHAR"),
    ]:
        if col not in _columns(bind, "invoices"):
            op.execute(f"ALTER TABLE invoices ADD COLUMN {col} {ddl}")
    op.execute("UPDATE invoices SET invoice_status = status")
    for col in ["customer_id", "amount", "status"]:
        if col in _columns(bind, "invoices"):
            op.drop_column("invoices", col)

    # inventory: recreate from current product stock
    if "inventory" not in tables:
        op.create_table(
            "inventory",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column("quantity_available", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reorder_level", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("warehouse_location", sa.String(), nullable=True),
            sa.Column("last_updated", sa.DateTime(), nullable=True),
        )
        op.execute(
            "INSERT INTO inventory (product_id, quantity_available, reorder_level, warehouse_location) "
            "SELECT id, stock_quantity, reorder_threshold, warehouse_location FROM products "
            "ON CONFLICT DO NOTHING"
        )

    # Other analytics tables are recreated as empty shells
    for table, cols in [
        ("alerts", [("business_id", "INTEGER"), ("alert_type", "VARCHAR"),
                    ("title", "VARCHAR"), ("description", "TEXT"),
                    ("priority", "VARCHAR"), ("is_read", "BOOLEAN DEFAULT false"),
                    ("created_at", "TIMESTAMP WITHOUT TIME ZONE")]),
        ("anomalies", [("anomaly_type", "VARCHAR"), ("reference_id", "INTEGER"),
                       ("severity", "VARCHAR"), ("confidence", "FLOAT"),
                       ("description", "TEXT"), ("detected_at", "TIMESTAMP WITHOUT TIME ZONE"),
                       ("resolved", "BOOLEAN DEFAULT false")]),
        ("forecasts", [("business_id", "INTEGER"), ("product_id", "INTEGER"),
                       ("forecast_date", "DATE"), ("predicted_sales", "FLOAT"),
                       ("predicted_revenue", "FLOAT"), ("model_used", "VARCHAR"),
                       ("confidence_score", "FLOAT"),
                       ("generated_at", "TIMESTAMP WITHOUT TIME ZONE")]),
        ("churn_predictions", [("customer_id", "INTEGER"), ("churn_probability", "FLOAT"),
                               ("risk_level", "VARCHAR"), ("recommendation", "TEXT"),
                               ("generated_at", "TIMESTAMP WITHOUT TIME ZONE")]),
        ("customer_segments", [("customer_id", "INTEGER"), ("segment_name", "VARCHAR"),
                               ("cluster_number", "INTEGER"), ("confidence", "FLOAT"),
                               ("generated_at", "TIMESTAMP WITHOUT TIME ZONE")]),
        ("product_recommendations", [("customer_id", "INTEGER"), ("product_id", "INTEGER"),
                                     ("recommendation_type", "VARCHAR"), ("score", "FLOAT"),
                                     ("generated_at", "TIMESTAMP WITHOUT TIME ZONE")]),
        ("inventory_transactions", [("product_id", "INTEGER"), ("user_id", "INTEGER"),
                                    ("transaction_type", "VARCHAR"), ("quantity", "INTEGER"),
                                    ("remarks", "VARCHAR"),
                                    ("created_at", "TIMESTAMP WITHOUT TIME ZONE")]),
    ]:
        if table not in _table_names(bind):
            cols_sql = ", ".join(f"{name} {ddl}" for name, ddl in cols)
            op.execute(f"CREATE TABLE {table} (id SERIAL PRIMARY KEY, {cols_sql})")

    # Drop the enum type once nothing references it
    op.execute("DROP TYPE IF EXISTS roleenum")
