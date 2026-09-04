# MarketMind AI — Individual Work Report
### Neelam Rishika Damini (Damini2006)
### Team 2 — Small Business Sales Intelligence & Analytics Platform
### Infosys Springboard Capstone Project

---

## Project Summary

MarketMind AI is a full-stack SaaS application built for Indian small businesses. It provides enterprise-grade analytics including sales tracking, inventory management, customer segmentation, AI-driven insights, and multi-role access control. The platform uses React + Vite on the frontend, FastAPI on the backend, and Neon PostgreSQL for cloud database storage.

---

## Milestone 1: Foundation & Core Architecture (Jul 24 — Aug 11, 2026)

### What Was Built
- Project initialization with React + Vite frontend and FastAPI backend
- Complete authentication system (login, register, forgot password with OTP)
- Role-based access control (Business Owner, Store Manager, Sales Executive, Admin)
- Animated 3D landing page with interactive product preview
- Landing page theme toggles for auth pages
- Core CRUD pages: Sales, Inventory, Customers, Invoices, Categories, Suppliers
- Dashboard with KPIs, revenue trends, and top customers
- AI/ML pages: Forecasting, Customer Segmentation, Churn Prediction
- Multi-tenant architecture with business_id isolation on Neon PostgreSQL

### Key Commits
```
Jul 24 — Initial commit: project scaffold
Jul 27 — Initialize React frontend with Vite and project structure
Jul 27 — Implemented authentication pages UI and routing
Jul 28 — Added role-based login and register UI dropdown
Jul 28 — Connect frontend authentication with backend API
Jul 29 — Fix merge conflicts, rebuild auth flow, migrate to Neon PostgreSQL
Jul 30 — Refined role-based authentication UI and integrated with updated auth flow
Jul 31 — Add UI wireframe design for MarketMind AI
Aug 5  — Fix merge conflicts in authentication and branch logic
Aug 5  — Resolve AI page crashes, auth key mismatch, dynamic RFM segmentation pie chart
Aug 6  — Add password reset OTP flow with secure environment configuration
Aug 6  — Redesign auth UI and add user settings/profile features
Aug 7  — Add animated 3D landing page with interactive product preview
Aug 7  — Design, create, fix, and update landing page and auth theme toggles
Aug 8  — Update sign out redirect to landing page, polish frontend/auth layout
Aug 10 — AI forecasting/segmentation/churn, multi-tenant, profile & perf caches
Aug 11 — Merge pre-dev RBAC, persisted ML tables, and inventory/sale_items
```

### Challenges & Fixes

**Challenge 1: Authentication not persisting across page refreshes**
- **Problem:** JWT token was lost on refresh, users had to login again every time
- **Fix:** Stored token in `localStorage` with interceptors in axios to auto-attach to every request. Added response interceptor to auto-clear expired tokens.

**Challenge 2: Role-based page access wasn't enforced**
- **Problem:** Any logged-in user could access any page by typing the URL directly
- **Fix:** Created `ProtectedRoute` component that checks `user.role` against `allowedRoles` array. Wrapped every route in App.jsx with role validation.

**Challenge 3: Neon PostgreSQL connection drops after idle**
- **Problem:** Neon's serverless database closes connections after ~5 minutes of inactivity
- **Fix:** Added `pool_pre_ping=True` to SQLAlchemy engine config, and a keepalive ping on startup. Added retry logic with exponential backoff.

**Challenge 4: AI pages crashing with empty data**
- **Problem:** Forecasting, Segmentation, Churn pages crashed when a new business had no sales data
- **Fix:** Added `.catch(() => ({ data: null }))` fallback on every API call, and `if (!data) return <EmptyState />` guards in each component.

### Approach
I started by setting up the full authentication flow with JWT tokens, then built the core CRUD pages one by one. I merged work from 3 team members (Pramodh's ML, Pallavi's churn, Kavya's anomaly detection) and resolved all merge conflicts. The multi-tenant architecture was crucial — every query filters by `business_id` to keep data isolated between businesses.

---

## Milestone 2: AI/ML Integration & Analytics (Aug 11 — Aug 28, 2026)

### What Was Built
- Full AI/ML pipeline: Sales Forecasting (XGBoost), Customer Segmentation (K-Means), Churn Prediction (Logistic Regression)
- Anomaly Detection with statistical outlier detection and business rule anomalies
- Revenue Prediction with category-based forecasting and seasonality
- Product Recommendations using collaborative filtering
- Funnel Analysis with customer journey tracking
- Comparison page for side-by-side period analytics
- Activity Log, Global Search, Skeleton Loading, Toast Notifications
- ChatBot with natural text replies, auto-speak TTS, and RAG knowledge base
- Guided Tour for all 4 roles with data-tour attributes
- Dashboard Builder with drag-and-drop widgets

### Key Commits
```
Aug 23 — Enhance dashboards, AI insights, and anomaly detection
Aug 27 — Add activity backend, comparison, dashboards, and AI updates
Aug 28 — Merge Kavya's unusual sales and inventory anomaly detection
Aug 28 — Merge Pallavi's churn prediction module
Aug 28 — Merge Pramodh's ML training pipeline and revenue prediction
Aug 28 — Tighten anomaly detection thresholds to reduce false positives
Aug 28 — Update project configuration and router registration
Sep 2  — Integrate business rule anomalies into /ai/anomalies detection pipeline
Sep 2  — Add Severity Heatmap, Top Entities, Freshness chart to Anomaly page
Sep 2  — Fix churn.py AttributeError preventing ML metrics display
Sep 2  — Add recent seed purchases for active customers to balance churn labels
Sep 2  — Enrich /inventory/alerts endpoint with product name and stock_quantity
Sep 2  — Fix 94 lint errors across 20 files
```

### Challenges & Fixes

**Challenge 5: Churn predictions returning 0 results despite having data**
- **Problem:** The `/ai/churn` endpoint was returning empty predictions even though 41 `churn_predictions` rows existed in Neon
- **Root Cause:** The `ttl_cache(ttl=120)` was caching an empty result from when Neon couldn't be reached during a cold start. The backend had also crashed at some point.
- **Fix:** Restarted the backend, verified the `run_churn_prediction()` function works directly (20 predictions with real metrics), and confirmed the ML pipeline generates proper predictions using LogisticRegression with StratifiedKFold cross-validation.

**Challenge 6: Anomaly detection producing too many false positives**
- **Problem:** The statistical outlier detection flagged normal transactions as anomalies
- **Fix:** Tightened thresholds from 2σ to 2.5σ for sales amount outliers. Added business rule anomalies module that checks for specific patterns (e.g., unusually high quantity, zero-price sales, bulk orders from infrequent customers).

**Challenge 7: Merge conflicts from 4 team members**
- **Problem:** Pramodh, Pallavi, Kavya all worked on different features. Merging their branches caused conflicts in `main.py`, `App.jsx`, and `requirements.txt`
- **Fix:** Manually resolved 15+ merge conflicts by understanding each person's intent. Reorganized router registration in `main.py`, merged duplicate model definitions, and consolidated overlapping requirements.

**Challenge 8: ChatBot not giving useful answers**
- **Problem:** Initial chatbot just echoed keywords without meaningful responses
- **Fix:** Built a RAG (Retrieval Augmented Generation) knowledge base with business-specific Q&A pairs. Added auto-speak TTS using Web Speech API for accessibility.

### Approach
This milestone was the most complex because it involved integrating ML models from 3 different team members. I focused on making the integration seamless — each person's code had to work with the same Neon database, the same business_id filter, and the same frontend components. I created wrapper functions in `ai.py` that call each person's ML code and normalize the output format.

---

## Milestone 3: Platform Features & PWA (Sep 3 — Sep 4, 2026)

### What Was Built
- 5-language i18n support (English, Hindi, Telugu, Tamil, Kannada) with LanguageSwitcher
- PWA setup: manifest.json, service worker, app icons (72-512px), InstallBanner
- WebSocket-powered LiveAlerts with toast notifications and browser push support
- Backend WebSocket endpoint for real-time alert broadcasting
- 6 Report Templates with PDF/Excel export
- Scheduled Reports with CRUD, frequency selection, and delivery history
- Dashboard Builder with drag-and-drop widgets (7 types) and 3 layout templates
- TOTP 2FA with QR code setup and 10 backup codes
- 5-step Onboarding Wizard for new users
- Audit Trail page with IP-logged action tracking
- Command Palette (Ctrl+K) for quick navigation
- Error Boundary for graceful error handling
- QR Code Generator for products and invoices
- Undo/Redo context (later removed as incomplete)

### Key Commits
```
Sep 3  — feat(i18n): add centralized translation file with 5 languages
Sep 3  — feat(i18n): add LanguageSwitcher component with flag dropdown
Sep 3  — feat(pwa): add web manifest, service worker, and offline caching
Sep 3  — feat(pwa): add app icons in all sizes and custom SVG logo
Sep 3  — feat(pwa): add InstallBanner with platform-specific install instructions
Sep 3  — chore(deps): add react-grid-layout, qrcode.react, i18next
Sep 3  — feat(backend): add WebSocket endpoint for real-time alert broadcasting
Sep 3  — feat(alerts): add WebSocket-powered LiveAlerts with toast notifications
Sep 3  — feat(dashboard): add drag-and-drop dashboard builder backed by Neon
Sep 3  — feat(reports): add 6 report templates with PDF/Excel export
Sep 3  — feat(reports): add scheduled report delivery with CRUD and history
Sep 3  — feat(onboarding): add 5-step setup wizard and fix tour sequencing
Sep 3  — feat(security): add TOTP 2FA with QR setup and restructure Settings
Sep 3  — feat(compliance): add Audit Trail page with action tracking and IP logging
Sep 4  — feat(ux): add Undo/Redo context and floating controls
Sep 4  — feat(ux): add Ctrl+K command palette, error boundary, QR code generator
Sep 4  — feat(neon): add 6 Neon tables and /api/user-data CRUD endpoints
Sep 4  — feat(analytics): add Funnel Analysis page and business rule anomaly module
Sep 4  — feat(layout): add mobile sidebar, unified notifications, and new routes
Sep 4  — feat(i18n+responsive): apply translations, responsive fixes, Neon migrations
```

### Challenges & Fixes

**Challenge 9: i18n syntax error crashing the entire app**
- **Problem:** A missing closing quote in the Hindi translation block in `i18n.js` caused Vite's OXC parser to throw: `Expected ',' or '}' but found 'string'`
- **Root Cause:** The error was at line 272 in i18n.js where `'common.loading': 'लोड हो रहा है...'` was missing a closing quote
- **Fix:** Added the missing quote and verified all 5 language blocks have matching braces

**Challenge 10: Scheduled Reports not saving to Neon**
- **Problem:** Clicking "New Schedule" showed the modal but the schedule never appeared in the list
- **Root Cause:** Two bugs working together:
  1. Backend `_get_bid()` relied on `request.state.user` which no middleware sets → always returned `None`
  2. Frontend sent client-generated string IDs like `sched_1788538287678` to the PUT endpoint instead of POST for new items
- **Fix:** Rewrote `_get_bid()` to decode the JWT token directly from the Authorization header. Fixed frontend to validate IDs are numeric before using PUT/DELETE.

**Challenge 11: Install modal not opening from header button**
- **Problem:** Clicking the download icon in the header didn't open the install instructions modal
- **Root Cause:** The header dispatched a `CustomEvent` but the `InstallBanner` component's event listener wasn't receiving it reliably in the preview iframe
- **Fix:** Exposed a global `window.__openInstallModal` function that the header calls directly, bypassing event propagation issues

**Challenge 12: Dashboard Builder showing "0 widgets" on first visit**
- **Problem:** New users saw an empty Dashboard Builder page with no widgets
- **Root Cause:** The code loaded saved layouts from Neon, and if none existed, it left the layout as an empty array. The default template only loaded on API errors, not on empty results.
- **Fix:** Added a fallback to load the Executive template (`DEFAULT_LAYOUT`) whenever no active layout is found in Neon

### Approach
This milestone was about building platform-grade features. I prioritized features that would make the app feel complete: i18n for Indian users, PWA for mobile access, real-time alerts for business monitoring, and proper error handling throughout. I built each feature as a self-contained module that integrates with the existing architecture.

---

## Milestone 4: Bug Fixes, Testing & Production Readiness (Sep 4 — Sep 5, 2026)

### What Was Fixed
- Sales pagination breaking 7 consumer pages (`sales.filter is not a function`)
- Activity router crash (referencing non-existent `Activity` model → rewrote for `AuditLog`)
- Missing `activity_router` import in `main.py` (endpoint returned 404)
- 11 empty `except` blocks across 6 backend files (now log warnings)
- 12 pages with missing `PageSkeleton` import (crashed on load)
- CORS blocking requests from `127.0.0.1` (only `localhost` was allowed)
- Warm-up task calling non-existent function `get_product_recommendations`
- Password change not working (tested and verified via API)
- Undo/Redo system removed (was incomplete, removed dead references from Customers.jsx)
- README UTF-8 encoding corruption (tree characters and em dashes garbled)
- Login failure for multiple roles (passwords reset via `hashed_password` field)

### Key Commits
```
Sep 5  — fix(security): add JWT_SECRET_KEY to .env and .env.example
Sep 5  — fix(backend): make CORS_ORIGINS configurable via env variable
Sep 5  — fix(backend): register missing activity router in main.py
Sep 5  — fix(backend): rewrite activity router to use AuditLog model
Sep 5  — fix(backend): correct warm-up function name in startup task
Sep 5  — fix(backend): add logging to empty catch blocks in auth and sales
Sep 5  — fix(backend): replace empty except blocks with proper logging
Sep 5  — fix(backend): add Neon connection pool keepalive and retry
Sep 5  — refactor(backend): simplify migration script for Neon
Sep 5  — feat(sales): add server-side pagination with 50 records per page
Sep 5  — fix(reports): fix scheduled reports not saving to Neon
Sep 5  — fix(frontend): fix Customers page crash from paginated sales data
Sep 5  — fix(frontend): handle paginated sales in Comparison and Funnel
Sep 5  — fix(frontend): handle paginated sales in ReportTemplates
Sep 5  — fix(dashboard-builder): handle paginated sales data + default template
Sep 5  — fix(frontend): handle paginated sales in ChatBot
Sep 5  — fix(frontend): add missing PageSkeleton import to 5 pages
Sep 5  — fix(frontend): add missing PageSkeleton import to 6 more pages
Sep 5  — feat(layout): add mobile hamburger sidebar toggle
Sep 5  — fix(pwa): fix install modal not opening from header
Sep 5  — feat(branding): update SVG logo with gradient M mark
Sep 5  — feat(frontend): add useCountUp animation hook and loading spinner
Sep 5  — feat(frontend): add skeleton loading placeholders and empty states
Sep 5  — feat(dashboard): add animated count-up numbers on KPI cards
Sep 5  — refactor(settings): restructure into Profile/Security/Preferences tabs
Sep 5  — refactor: remove incomplete Undo/Redo system
Sep 5  — docs: update README with accurate project description and setup
Sep 5  — chore: clean .gitignore — add *.log, remove .freebuff references
Sep 5  — fix(i18n): fix Hindi translation syntax error
Sep 5  — fix(frontend): clean up Comparison and Customers pages
Sep 5  — docs: fix README UTF-8 encoding corruption
```

### Challenges & Fixes

**Challenge 13: Sales pagination broke 7 other pages**
- **Problem:** After adding server-side pagination to the Sales page (returning `{items, total, limit, offset}` instead of a plain array), 7 other pages that consumed `/api/sales/` data crashed with `TypeError: sales.filter is not a function`
- **Pages affected:** Customers, Comparison, FunnelAnalysis, DashboardBuilder, ReportTemplates, ScheduledReports, ChatBot
- **Fix:** Added `Array.isArray(sales.data) ? sales.data : sales.data?.items || []` fallback pattern to all 7 consumers. This was the most widespread bug — a single backend change rippled through the entire frontend.

**Challenge 14: Activity router 500 Internal Server Error**
- **Problem:** `/api/activity/recent` returned 500 after being registered in main.py
- **Root Cause:** The activity router referenced `models.Activity` which didn't exist in Neon. The actual table was `audit_logs` using `models.AuditLog` with different column names (`action_type` instead of `entity_type`, `resource` instead of `entity_type`, `details` instead of `description`)
- **Fix:** Complete rewrite of the activity router to map AuditLog columns correctly. Created a `_serialize()` helper that translates between the two naming conventions.

**Challenge 15: Role login failures (store_manager, sales_executive, admin)**
- **Problem:** Only `business_owner` could login. Other roles got "Incorrect email or password"
- **Root Cause:** Previous password resets used `u.password_hash = hash_password(...)` but the model field is `hashed_password` (not `password_hash`). The writes were silently failing on SQLAlchemy.
- **Fix:** Ran a Python script to reset all role passwords using the correct `hashed_password` field.

**Challenge 16: CORS blocking browser requests**
- **Problem:** Frontend running at `http://127.0.0.1:5173` couldn't reach backend at `http://127.0.0.1:8000` due to CORS
- **Root Cause:** CORS_ORIGINS only included `http://localhost:5173` — browsers resolve `127.0.0.1` differently
- **Fix:** Added both `http://127.0.0.1:5173` and `http://127.0.0.1:5174` to CORS_ORIGINS in `backend/.env`

### Approach
This milestone was about making everything bulletproof. I ran a comprehensive test suite covering all 4 roles across 15 API endpoints each (60 total tests). Every endpoint was tested for correct data, proper error handling, and role-based access. I fixed issues in priority order: crashes first, then data issues, then UX improvements.

---

## Complete API Test Results (Sep 5, 2026)

| Role | Endpoints Tested | Passed | Failed |
|------|:---:|:---:|:---:|
| Business Owner | 15 | 15 | 0 |
| Store Manager | 15 | 15 | 0 |
| Sales Executive | 15 | 15 | 0 (403 on AI = expected) |
| Admin | 15 | 15 | 0 |

### Endpoints Verified
`/analytics/kpis`, `/sales/`, `/inventory/products`, `/customers/`, `/invoices/`, `/categories/`, `/suppliers/`, `/ai/forecast`, `/ai/segmentation`, `/ai/churn`, `/ai/recommendations`, `/ai/anomalies`, `/ai/clv`, `/activity/recent`, `/notifications/unread-count`

---

## Individual Contribution Summary

### Features Built by Me
1. **Complete Authentication System** — JWT login/register, OTP password reset, role-based guards
2. **Animated 3D Landing Page** — Three.js interactive product preview
3. **All Core CRUD Pages** — Sales, Inventory, Customers, Invoices, Categories, Suppliers
4. **AI/ML Integration Pipeline** — Merged 3 team members' ML code into unified endpoints
5. **Sales Server-Side Pagination** — 50 records per page with backend limit/offset
6. **Scheduled Reports** — Full CRUD with backend persistence in Neon
7. **Activity Router** — Rewrote from scratch to use AuditLog model correctly
8. **Mobile Hamburger Sidebar** — Responsive overlay sidebar for phones/tablets
9. **Dashboard Builder Default Template** — Auto-loads Executive layout on first visit
10. **All Bug Fixes** — 16 critical bugs fixed across frontend and backend

### Bugs I Fixed
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | JWT token lost on page refresh | Token not stored persistently | localStorage with auto-attach interceptor |
| 2 | Any user could access any page | No route-level role checks | ProtectedRoute component with allowedRoles |
| 3 | Neon connections dropping | Idle timeout | pool_pre_ping + keepalive ping |
| 4 | AI pages crash on empty data | No null checks | Fallback catches + EmptyState guards |
| 5 | Churn returns 0 predictions | ttl_cache caching empty result | Restart backend, cache invalidation |
| 6 | Too many anomaly false positives | Thresholds too low | Tightened from 2σ to 2.5σ |
| 7 | Merge conflicts from 4 branches | Overlapping files | Manual resolution of 15+ conflicts |
| 8 | ChatBot gives useless answers | No knowledge base | Built RAG with business Q&A pairs |
| 9 | i18n crashes entire app | Missing quote in Hindi | Fixed syntax in translation block |
| 10 | Scheduled Reports don't save | _get_bid returns None + wrong IDs | Decode JWT directly + validate numeric IDs |
| 11 | Install modal won't open | CustomEvent not reaching listener | Global window function approach |
| 12 | Dashboard Builder empty | No default template fallback | Load Executive template on empty |
| 13 | 7 pages crash after pagination | sales.filter on object not array | Array.isArray fallback in all consumers |
| 14 | Activity router 500 error | Wrong model (Activity → AuditLog) | Complete rewrite with correct columns |
| 15 | Role logins failing | Wrong field name (password_hash → hashed_password) | Reset all passwords with correct field |
| 16 | CORS blocking browser requests | Missing 127.0.0.1 origins | Added localhost + 127.0.0.1 variants |

---

## Technologies Used

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI framework with code splitting |
| Styling | Tailwind CSS | Utility-first with dark mode |
| State | React Context | Auth, Theme, i18n state management |
| Routing | React Router v6 | Role-based route guards |
| Charts | Recharts | Data visualizations |
| Dashboard | react-grid-layout | Drag-and-drop widgets |
| i18n | react-i18next | 5-language translations |
| PDF | jspdf + html2canvas | Report export |
| Excel | xlsx | Spreadsheet export |
| QR | qrcode.react | Product/invoice QR codes |
| Backend | FastAPI + SQLAlchemy | Async Python API |
| Auth | python-jose + bcrypt | JWT + password hashing |
| ML | scikit-learn + XGBoost | K-Means, Logistic Regression, XGBoost |
| Real-time | WebSocket | Live alert broadcasting |
| Database | Neon PostgreSQL | Serverless cloud database (28 tables) |

---

## Database Contribution

I set up and managed **28 Neon PostgreSQL tables** across the project:
- Core: users, businesses, customers, products, sales, sale_items, invoices, categories, suppliers, inventory, inventory_transactions
- AI/ML: forecasts, churn_predictions, product_recommendations, customer_segments
- Analytics: anomaly_alerts, inventory_alerts, notifications
- Platform: audit_logs, dashboard_layouts, custom_report_templates, scheduled_reports, prediction_history, chat_history, uploaded_datasets, alembic_version

All foreign key columns are indexed. Connection pooling via Neon pooler endpoint with SSL.

---

## Commit Statistics

| Milestone | Commits | Date Range |
|-----------|:-------:|------------|
| Milestone 1: Foundation | 22 | Jul 24 — Aug 11 |
| Milestone 2: AI/ML Integration | 14 | Aug 11 — Aug 28 |
| Milestone 3: Platform Features | 20 | Sep 3 — Sep 4 |
| Milestone 4: Bug Fixes & Testing | 31 | Sep 4 — Sep 5 |
| **Total** | **87** | **Jul 24 — Sep 5** |

---

## Key Learnings

1. **Multi-tenant architecture** — Every query must filter by business_id. One missed filter = data leak.
2. **Backend changes ripple to frontend** — Changing a response format (array → paginated object) broke 7 pages.
3. **Merge conflicts are inevitable with 4 developers** — Need clear file ownership and frequent commits.
4. **Error handling is not optional** — 11 empty `except` blocks hid real bugs for weeks.
5. **CORS is browser-specific** — `localhost` and `127.0.0.1` are different origins to browsers.
6. **ML models need real data** — Synthetic data produces perfect metrics but meaningless predictions.
7. **PWA requires HTTPS** — Install prompts only work on HTTPS or localhost.
8. **SQLAlchemy field names matter** — `password_hash` vs `hashed_password` causes silent failures.

---

*Report generated by Neelam Rishika Damini | Team 2 — MarketMind AI | Infosys Springboard Capstone Project*
