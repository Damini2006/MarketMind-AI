# MarketMind AI — Forensic Codebase Audit & Specification Reconciliation

**Date of Audit**: September 2026  
**Repository**: `Team_2_Small_Biz_AI` (MarketMind AI)  
**Auditor**: Automated Forensic Codebase Analysis Engine  
**Methodology**: Static AST code parsing, model/schema inspection, route extraction, algorithm reverse-engineering, security audit.  

---

## 1. Executive Summary & Completion Scorecard

The project **MarketMind AI** is a functional prototype and MVP-ready application with a polished React frontend and a FastAPI backend with working scikit-learn models and multi-tenant PostgreSQL integration. However, **claims of "production-readiness" and advanced enterprise ML architectures (e.g. Prophet, XGBoost, Apriori, LLM-RAG, Docker orchestration) are inaccurate and exaggerated**.

### Forensic Completion Scorecard

| Module / Domain | Score | Verdict |
| :--- | :---: | :--- |
| **Core CRUD & Business Operations** | **88%** | ✅ Mostly complete (Sales, Inventory, Invoices, Customers, Suppliers, Categories). |
| **Multi-Tenancy & Data Scoping** | **85%** | ⚠️ Implemented via `business_id` across 90%+ queries, but minor IDOR data leaks exist. |
| **AI / Machine Learning Engine** | **55%** | ⚠️ Real scikit-learn models exist (K-Means, LinearRegression, LogisticRegression, IsolationForest), but Prophet, XGBoost, Random Forest, and Apriori are **absent**. |
| **Security & Authentication** | **70%** | ⚠️ Solid JWT/RBAC on HTTP routes, but **WebSocket is completely unauthenticated** and JWT secret falls back to volatile random string. |
| **AI Chatbot** | **25%** | ❌ **No LLM / No RAG**. Purely hardcoded keyword/regex matching against database aggregates. |
| **Reporting & Scheduling** | **40%** | ⚠️ Template creation and database storage work; **automated background scheduler/mailer does not exist**. |
| **Testing & Quality Assurance** | **20%** | ❌ No unit tests, no frontend tests; only 1 ad-hoc HTTP integration script (`test_all_endpoints.py`). |
| **DevOps & Containerization** | **0%** | ❌ **No Dockerfile, no docker-compose.yml, no nginx.conf** found anywhere in the repository. |
| **OVERALL PROJECT COMPLETION** | **54%** | **BETA / MVP READY (NOT PRODUCTION READY)** |

---

## 2. Feature Completion Matrix

| Feature Specification | Status | Exact Code Reference | Missing Work / Gaps |
| :--- | :---: | :--- | :--- |
| **User Registration & Login** | ✅ Fully Implemented | `backend/app/routers/auth.py:register, login` | None. Bcrypt hashing + JWT token issuance. |
| **Role-Based Access Control (RBAC)**| ✅ Fully Implemented | `backend/app/deps.py:require_roles` | Applied across mutating endpoints. |
| **Password Reset via OTP** | ✅ Fully Implemented | `backend/app/routers/auth.py:send_otp, reset_password_otp` | OTP generated & verified; email delivery requires active SMTP credentials. |
| **Sales Order Creation & History** | ✅ Fully Implemented | `backend/app/routers/sales.py:create_sale, list_sales` | Multi-item ledger in `sale_items`. |
| **Sales CSV Upload & Parsing** | ✅ Fully Implemented | `backend/app/routers/sales.py:upload_sales_csv` | Pandas parsing, numeric coercion, logging to `uploaded_datasets`. |
| **Inventory Stock Management** | ✅ Fully Implemented | `backend/app/routers/inventory.py:products, update_stock` | Stock adjustment + transaction history in `inventory_transactions`. |
| **Low-Stock Alert Triggering** | ✅ Fully Implemented | `backend/app/routers/inventory.py:_check_and_create_alert` | Creates record in `inventory_alerts` when stock <= threshold. |
| **Invoice Generation & Tracking**| ✅ Fully Implemented | `backend/app/routers/invoices.py` | Status toggle (`paid`, `pending`, `overdue`), overdue scanner. |
| **PDF / Excel Document Export** | ✅ Fully Implemented | `frontend/src/utils/exportUtils.js` | Client-side `jspdf`, `jspdf-autotable`, and `xlsx` generation. |
| **Customer CRM & Directory** | ✅ Fully Implemented | `backend/app/routers/customers.py` | Customer profiles, lifetime revenue tracking, CSV import. |
| **Sales Demand Forecasting** | ⚠️ Partially Implemented| `backend/app/routers/ai.py:get_sales_forecast` | Uses simple **Linear Regression** on day/weekday/month. **Prophet and XGBoost are missing**. Results not saved to DB. |
| **Customer RFM Segmentation** | ✅ Fully Implemented | `backend/app/routers/ai.py:get_customer_segments` | **K-Means clustering** with `StandardScaler` and silhouette scoring. Hierarchical clustering is missing. |
| **Customer Churn Risk Scoring** | ⚠️ Partially Implemented| `backend/app/routers/ai.py:get_churn_risk` | **Logistic Regression** + RFM inactivity heuristic. **Random Forest and XGBoost are missing**. |
| **Product Recommendations** | ⚠️ Partially Implemented| `backend/app/routers/ai.py:get_product_recommendations` | **Item co-occurrence matrix heuristic** with AOV budget check. **Apriori / FP-Growth / SVD are missing**. |
| **Anomaly Detection** | ✅ Fully Implemented | `backend/app/ml/anomaly_detection.py`, `ai.py` | **Isolation Forest** on transactions + Business Rule threshold checks. |
| **AI Assistant / Chatbot** | ❌ Not Implemented | `backend/app/routers/ai.py:ai_chat` | **No LLM / No RAG**. Pure regex keyword search matching (`if 'revenue' in q`). |
| **Automated Report Scheduler** | ⚠️ Partially Implemented| `backend/app/routers/user_data.py:scheduled_reports` | **CRUD endpoints & DB storage only**. No background worker (Celery/APScheduler/cron) executes the schedule. |
| **Custom Dashboard Builder** | ✅ Fully Implemented | `frontend/src/pages/DashboardBuilder.jsx`, `user_data.py` | Drag-and-drop grid system using `react-grid-layout` with DB persistence. |
| **Real-time WebSocket Alerts** | ⚠️ Partially Implemented| `backend/app/routers/websocket_alerts.py` | Server broadcaster loop exists, but **unauthenticated** and fails in multi-worker setups. |
| **Audit Trail & Geo-Intelligence** | ✅ Fully Implemented | `backend/app/routers/audit.py`, `core/client_info.py` | User-agent parsing, IP coordinate extraction, suspicious activity scoring. |
| **In-Memory Cache (TTL 600s)** | ⚠️ Partially Implemented| `backend/app/cache.py` | Dict-based in-memory cache with eviction. **Process-local (not shared across Uvicorn workers)**. |
| **Docker & Deployment Manifests**| ❌ Not Implemented | N/A | **Zero Dockerfiles or orchestration files exist**. |

---

## 3. AI / Machine Learning Reality Check

| ML Module | Specified in Proposal | Actual Code Implementation | Training / Evaluation | Metrics Computed? | Production Persistence? |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Sales Forecasting** | Prophet, XGBoost, Random Forest Regressor | **`sklearn.linear_model.LinearRegression`** over `[day_idx, weekday, month]` | Retrained on-the-fly per request over tenant sales rows | $R^2$, MAE, RMSE calculated | ❌ Cached in memory (TTL 600s), but not saved to `forecasts` table |
| **Customer Segmentation** | K-Means, Hierarchical Clustering, RFM | **`sklearn.cluster.KMeans`** over `[Recency, Frequency, Monetary]` + `StandardScaler` | Dynamic K-Means ($k \in [2, 8]$) selecting best silhouette score | Silhouette Score calculated | ❌ Returned in JSON, not saved to `customer_segments` table |
| **Churn Prediction** | Logistic Regression, Random Forest, XGBoost | **Hybrid Heuristic + `LogisticRegression`** | LogisticRegression when $>10$ historical samples; heuristic inactivity ($>60\text{ days}$) fallback | Cross-validated Accuracy, Precision, Recall, F1 in `ml/churn.py` | ❌ Computed per request; not saved to `churn_predictions` table |
| **Product Recommendations** | Collaborative Filtering, Association Rules (Apriori, FP-Growth) | **Item Co-occurrence Frequency Matrix** + Customer AOV filtering | Python/SQL counting of co-purchased product pairs in same sale | Precision@K / Recall@K **NOT calculated** | ❌ Computed dynamically; `product_recommendations` table unused |
| **Anomaly Detection** | Isolation Forest, Statistical Outliers | **`sklearn.ensemble.IsolationForest`** + Rule-based threshold filters | IsolationForest over `[qty, price, total, hour, weekday]` with 5% contamination | Z-score, anomaly severity scores | ✅ Persisted to `anomaly_alerts` table |

---

## 4. API & Route Inventory (Actual vs Claimed)

* **Claimed Endpoints in Documentation**: 94 endpoints
* **Actual Unique Route Decorators in Backend**: **85 endpoints** (plus 3 root/health routes = 88 total routes).
* **Explanation of Difference**: The previous document counted duplicate HTTP methods (`POST` and `GET` on same path) and static file mounts (`/uploads`) as separate standalone endpoints.

### Full Route Inventory:

| Router | Method | Path | Function | Auth Required? | Roles Allowed |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `auth` | `POST` | `/api/auth/register` | `register` | No | Public |
| `auth` | `POST` | `/api/auth/login` | `login` | No | Public |
| `auth` | `GET` | `/api/auth/me` | `get_me` | Yes | All Roles |
| `auth` | `PUT` | `/api/auth/profile` | `update_profile` | Yes | All Roles |
| `auth` | `PUT` | `/api/auth/change-password` | `change_password` | Yes | All Roles |
| `auth` | `POST` | `/api/auth/send-otp` | `send_otp` | No | Public |
| `auth` | `POST` | `/api/auth/reset-password-otp` | `reset_password_otp` | No | Public |
| `analytics` | `GET` | `/api/analytics/pulse` | `get_pulse` | Yes | All Roles |
| `analytics` | `GET` | `/api/analytics/kpis` | `get_kpis` | Yes | All Roles |
| `inventory` | `GET` | `/api/inventory/products` | `list_products` | Yes | All Roles |
| `inventory` | `POST` | `/api/inventory/products` | `create_product` | Yes | Owner, Manager, Admin |
| `inventory` | `PATCH`| `/api/inventory/products/{id}/stock` | `update_stock` | Yes | Owner, Manager, Admin |
| `inventory` | `GET` | `/api/inventory/alerts` | `list_alerts` | Yes | All Roles |
| `inventory` | `POST` | `/api/inventory/products/upload-csv` | `upload_products_csv` | Yes | Owner, Manager, Admin |
| `sales` | `GET` | `/api/sales/` | `list_sales` | Yes | All Roles |
| `sales` | `POST` | `/api/sales/` | `create_sale` | Yes | All Roles |
| `sales` | `POST` | `/api/sales/upload-csv` | `upload_sales_csv` | Yes | All Roles |
| `invoices` | `GET` | `/api/invoices/` | `list_invoices` | Yes | All Roles |
| `invoices` | `POST` | `/api/invoices/` | `create_invoice` | Yes | All Roles |
| `invoices` | `PATCH`| `/api/invoices/{id}/status` | `update_invoice_status` | Yes | All Roles |
| `invoices` | `GET` | `/api/invoices/overdue/check` | `check_overdue_invoices` | Yes | All Roles |
| `customers` | `GET` | `/api/customers/` | `list_customers` | Yes | All Roles |
| `customers` | `POST` | `/api/customers/` | `create_customer` | Yes | All Roles |
| `customers` | `GET` | `/api/customers/{id}` | `get_customer` | Yes | All Roles |
| `customers` | `DELETE`| `/api/customers/{id}` | `delete_customer` | Yes | Owner, Admin |
| `customers` | `POST` | `/api/customers/upload-csv` | `upload_customers_csv` | Yes | All Roles |
| `categories`| `GET` | `/api/categories/` | `list_categories` | Yes | All Roles |
| `categories`| `POST` | `/api/categories/` | `create_category` | Yes | Owner, Manager, Admin |
| `categories`| `DELETE`| `/api/categories/{id}` | `delete_category` | Yes | Owner, Admin |
| `suppliers` | `GET` | `/api/suppliers/` | `list_suppliers` | Yes | All Roles |
| `suppliers` | `POST` | `/api/suppliers/` | `create_supplier` | Yes | Owner, Manager, Admin |
| `suppliers` | `DELETE`| `/api/suppliers/{id}` | `delete_supplier` | Yes | Owner, Admin |
| `ai` | `GET` | `/api/ai/forecast` | `get_sales_forecast` | Yes | Owner, Manager, Admin |
| `ai` | `GET` | `/api/ai/forecasting` | `get_sales_forecast` (alias) | Yes | Owner, Manager, Admin |
| `ai` | `GET` | `/api/ai/segmentation` | `get_customer_segments` | Yes | Owner, Manager, Admin |
| `ai` | `GET` | `/api/ai/churn` | `get_churn_risk` | Yes | Owner, Manager, Admin |
| `ai` | `GET` | `/api/ai/recommendations` | `get_product_recommendations`| Yes | All Roles |
| `ai` | `GET` | `/api/ai/recommendations/customer/{id}` | `get_customer_recommendations`| Yes | All Roles |
| `ai` | `POST` | `/api/ai/recommendations/cross-sell` | `get_cross_sell` | Yes | All Roles |
| `ai` | `POST` | `/api/ai/recommendations/train` | `train_recommendations` | Yes | Owner, Admin |
| `ai` | `GET` | `/api/ai/anomalies` | `get_anomalies` | Yes | All Roles |
| `ai` | `POST` | `/api/ai/anomalies/rescan` | `rescan_anomalies` | Yes | Owner, Admin |
| `ai` | `GET` | `/api/ai/clv` | `get_clv` | Yes | All Roles |
| `ai` | `GET` | `/api/ai/chat` | `ai_chat` | Yes | All Roles |
| `audit` | `GET` | `/api/audit/logs` | `list_audit_logs` | Yes | Admin only |
| `audit` | `POST` | `/api/audit/logs` | `create_audit_log` | Yes | All Roles |
| `audit` | `GET` | `/api/audit/stats` | `audit_stats` | Yes | Admin only |
| `user_data` | `GET` | `/api/user-data/scheduled-reports` | `list_scheduled_reports` | Yes | All Roles |
| `user_data` | `POST` | `/api/user-data/scheduled-reports` | `create_scheduled_report` | Yes | All Roles |
| `user_data` | `PUT` | `/api/user-data/scheduled-reports/{id}` | `update_scheduled_report` | Yes | All Roles |
| `user_data` | `DELETE`| `/api/user-data/scheduled-reports/{id}` | `delete_scheduled_report` | Yes | All Roles |
| `user_data` | `GET` | `/api/user-data/dashboard-layouts` | `list_layouts` | Yes | All Roles |
| `user_data` | `POST` | `/api/user-data/dashboard-layouts` | `save_layout` | Yes | All Roles |
| `user_data` | `PUT` | `/api/user-data/dashboard-layouts/{id}`| `update_layout` | Yes | All Roles |
| `user_data` | `DELETE`| `/api/user-data/dashboard-layouts/{id}`| `delete_layout` | Yes | All Roles |
| `user_data` | `GET` | `/api/user-data/report-templates` | `list_templates` | Yes | All Roles |
| `user_data` | `POST` | `/api/user-data/report-templates` | `create_template` | Yes | All Roles |
| `user_data` | `PUT` | `/api/user-data/report-templates/{id}` | `update_template` | Yes | All Roles |
| `user_data` | `DELETE`| `/api/user-data/report-templates/{id}` | `delete_template` | Yes | All Roles |
| `user_data` | `GET` | `/api/user-data/prediction-history` | `list_prediction_history`| Yes | All Roles |
| `user_data` | `POST` | `/api/user-data/prediction-history` | `create_prediction_history`| Yes | All Roles |
| `user_data` | `GET` | `/api/user-data/chat-history` | `get_chat_history` | Yes | All Roles |
| `user_data` | `POST` | `/api/user-data/chat-history` | `save_chat_history` | Yes | All Roles |
| `user_data` | `DELETE`| `/api/user-data/chat-history` | `clear_chat_history` | Yes | All Roles |
| `users` | `GET` | `/api/users/` | `list_users` | Yes | Owner, Admin |
| `users` | `POST` | `/api/users/` | `create_user` | Yes | Owner, Admin |
| `users` | `DELETE`| `/api/users/{id}` | `delete_user` | Yes | Owner, Admin |
| `users` | `GET` | `/api/users/business` | `get_business_info` | Yes | All Roles |
| `users` | `POST` | `/api/users/avatar` | `upload_avatar` | Yes | All Roles |
| `users` | `DELETE`| `/api/users/avatar` | `delete_avatar` | Yes | All Roles |
| `users` | `GET` | `/api/users/tour-status` | `get_tour_status` | Yes | All Roles |
| `users` | `PUT` | `/api/users/tour-status` | `set_tour_status` | Yes | All Roles |
| `notifications`| `GET` | `/api/notifications/` | `list_notifications` | Yes | All Roles |
| `notifications`| `GET` | `/api/notifications/unread-count` | `unread_count` | Yes | All Roles |
| `notifications`| `POST` | `/api/notifications/read-all` | `mark_all_read` | Yes | All Roles |
| `notifications`| `POST` | `/api/notifications/{id}/read` | `mark_read` | Yes | All Roles |
| `activity` | `GET` | `/api/activity/log` | `list_activity` | Yes | All Roles |
| `activity` | `GET` | `/api/activity/recent` | `recent_activity` | Yes | All Roles |
| `activity` | `GET` | `/api/activity/stats` | `activity_stats` | Yes | All Roles |
| `activity` | `GET` | `/api/activity/heatmap` | `activity_heatmap` | Yes | All Roles |
| `activity` | `GET` | `/api/activity/users` | `active_users` | Yes | All Roles |
| `system` | `GET` | `/api/system/login-map` | `get_login_map` | Yes | Admin only |
| `system` | `GET` | `/api/system/cache-stats` | `get_cache_stats` | Yes | Admin only |
| `datasets` | `GET` | `/api/datasets/` | `list_datasets` | Yes | All Roles |
| `revenue` | `POST` | `/api/revenue/predict` | `predict_revenue` | Yes | All Roles |
| `websocket` | `WS` | `/ws/alerts/{business_id}` | `websocket_alerts` | ❌ No Auth | Anyone |

---

## 5. Security & Multi-Tenancy Findings

### 🔴 CRITICAL VULNERABILITIES:

1. **Unauthenticated WebSocket Alert Stream (`backend/app/routers/websocket_alerts.py:200`)**:
   * **Issue**: The endpoint `@router.websocket("/ws/alerts/{business_id}")` accepts any incoming connection without token or cookie authentication.
   * **Exploit**: Any external attacker can connect to `/ws/alerts/1` and stream live internal low-stock alerts, transaction amounts, and anomaly notifications for Business #1 in real time.
   * **Remediation**: Require a query parameter `?token=...` during WebSocket handshake and decode/validate JWT against `business_id`.

2. **Volatile Fallback JWT Secret Key (`backend/app/main.py:12`)**:
   * **Issue**: If `JWT_SECRET_KEY` is not present in `.env`, the backend generates a random key in memory on every startup.
   * **Impact**: Whenever the backend restarts or serverless cold-start occurs, all existing JWT tokens become invalid, logging out all active users simultaneously.
   * **Remediation**: Fail fast on startup (`raise RuntimeError("JWT_SECRET_KEY is mandatory")`).

### 🟠 HIGH RISK / DATA LEAK FINDINGS:

3. **Multi-Tenant User Data Leak in AI Chatbot (`backend/app/routers/ai.py:756`)**:
   * **Issue**: `users = db.query(models.User).all()` does not include `.filter(models.User.business_id == biz_id)`.
   * **Exploit**: If User A asks "Show team", the response returns names of users belonging to all other businesses in the database.
   * **Remediation**: Add `.filter(models.User.business_id == biz_id)`.

4. **Multi-Tenant Data Leak in Anomaly Alert Fallback (`backend/app/routers/ai.py:749`)**:
   * **Issue**: `alerts = db.query(models.AnomalyAlert).all()` if `biz_id` is None/evaluates false.
   * **Remediation**: Enforce strict non-null `biz_id` filter.

---

## 6. Architecture & Infrastructure Audit

### A. In-Memory Cache vs. Multi-Worker Uvicorn
* The cache in `backend/app/cache.py` uses a local Python `dict` with timestamp checks.
* **Problem**: In a standard production Uvicorn deployment (`--workers 4`), each worker process has a separate private RAM space. A cache invalidation triggered on Worker 1 (e.g. creating a new sale) will **not invalidate the cache on Workers 2, 3, or 4**, serving stale data to clients depending on load balancer round-robin routing.
* **Fix**: For multi-worker production, replace the local dict with **Redis**.

### B. Scheduled Reports Missing Worker
* The table `scheduled_reports` stores report configurations.
* **Problem**: There is no task worker (APScheduler, Celery, or system cron) running in the background to actually compile PDFs and send emails at scheduled intervals.
* **Status**: Database CRUD is complete, but background job execution is **missing**.

---

## 7. Prioritized Action Plan to Reach True Production Readiness

### P0 — Must Fix (Security & Correctness Blockers)
1. **Secure the WebSocket Endpoint**: Add JWT token verification to `websocket_alerts.py` to prevent unauthorized eavesdropping on business alerts.
2. **Fix Cross-Tenant Leak in AI Chat**: Add `business_id` filter to `User` query in `backend/app/routers/ai.py:756`.
3. **Mandate `JWT_SECRET_KEY`**: Remove volatile random generation fallback in `backend/app/core/security.py` so missing secret fails fast.
4. **Create Real Docker Manifests**: Add `backend/Dockerfile`, `frontend/Dockerfile`, and `docker-compose.yml` to the codebase.

### P1 — Should Fix (Specification & Architecture Gaps)
5. **Implement True Background Scheduler**: Add `APScheduler` or FastAPI background task loop to actually execute and email scheduled reports.
6. **Reconcile ML Claims**: Update documentation or implement true Random Forest / XGBoost models if required by external course/client specification.
7. **Replace Local Memory Cache with Redis**: Needed for multi-worker Uvicorn concurrency.
8. **Add Automated Unit Tests**: Build a `tests/` directory with `pytest` testing multi-tenant isolation (Tenant A attempting to query Tenant B data).

### P2 — Recommended Improvements
9. **Upgrade AI Chatbot to Real LLM**: Connect `/api/ai/chat` to an OpenAI / Gemini API endpoint with tenant-scoped RAG context rather than static regex matching.
10. **Persist ML Output to Tables**: Write forecasting and recommendation outputs directly to `forecasts` and `product_recommendations` tables.
