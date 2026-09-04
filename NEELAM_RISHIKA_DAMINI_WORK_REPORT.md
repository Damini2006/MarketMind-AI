# MarketMind AI — Individual Work Report
### Neelam Rishika Damini (Damini2006)
### Team 2 — Small Business Sales Intelligence & Analytics Platform
### Infosys Springboard Capstone Project

---

## Milestone 1: Foundation, Core Architecture & AI/ML Pages (Jul 24 — Aug 11)
**Week 1 & 2 — Dataset Collection, Design Process & Dashboard Setup**

### My Contributions

#### Project Initialization (Jul 24 — Jul 27)
- Initialized React frontend with Vite and configured Tailwind CSS
- Set up FastAPI backend with SQLAlchemy ORM and Neon PostgreSQL
- Created project structure with routers, models, schemas, and ML modules

#### Authentication System (Jul 27 — Jul 30)
- Built complete login and register pages with role-based UI dropdown
- Connected frontend authentication with backend JWT API
- Implemented role selection during registration (Business Owner, Store Manager, Sales Executive, Admin)
- Added role-based page access control using `ProtectedRoute` component
- Refined auth UI and integrated with updated backend auth flow

#### System Design & Wireframes (Jul 31)
- Created UI wireframe design for all pages
- Designed database schema with 28 PostgreSQL tables
- Documented system architecture (Frontend → Backend → Neon PostgreSQL)

#### Core Dashboard & CRUD Pages (Jul 30 — Aug 8)
- Built Dashboard with role-based KPIs, revenue trends, and top customers
- Implemented Sales page with CSV upload and transaction tracking
- Built Inventory page with stock monitoring and low-stock alerts
- Created Customers page with RFM segmentation and CLV prediction
- Implemented Invoices page with status tracking
- Built Categories and Suppliers management pages
- Added Team member management with role assignment

#### Animated 3D Landing Page (Aug 7)
- Built interactive 3D landing page with Three.js product preview
- Added dark/light theme toggles for auth and landing pages
- Implemented smooth scroll and responsive design

#### Auth Fixes & Profile Features (Aug 5 — Aug 8)
- Fixed merge conflicts in authentication and branch logic
- Resolved AI page crashes caused by auth key mismatch
- Fixed dynamic RFM segmentation pie chart rendering
- Added password reset OTP flow with Gmail SMTP
- Redesigned auth UI with profile and settings features
- Updated sign out redirect to landing page

#### AI/ML Page Integration (Aug 10 — Aug 11)
- Integrated Sales Forecasting page with XGBoost predictions
- Built Customer Segmentation page with K-Means clustering
- Implemented Churn Prediction page with risk scoring
- Added multi-tenant architecture with business_id isolation
- Merged pre-dev RBAC, persisted ML tables, and inventory/sale_items

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

### Bugs Fixed in Milestone 1
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | JWT token lost on page refresh | Token not stored persistently | localStorage with auto-attach interceptor |
| 2 | Any user could access any page | No route-level role checks | ProtectedRoute component with allowedRoles |
| 3 | Neon connections dropping | Idle timeout | pool_pre_ping + keepalive ping |
| 4 | AI pages crash on empty data | No null checks | Fallback catches + EmptyState guards |

---

## Milestone 2: AI/ML Integration, Activity & Advanced Features (Aug 11 — Aug 28)
**Week 3 & 4 — Customer Segmentation & Sales Forecasting Enhancement**

### My Contributions

#### Activity Log & Search (Aug 27)
- Built activity log backend with audit trail endpoints
- Implemented global search across all pages
- Added skeleton loading animation for all data pages
- Integrated toast notifications for user feedback

#### ChatBot with AI (Aug 27)
- Upgraded chatbot with natural text replies
- Added auto-speak TTS (Text-to-Speech) using Web Speech API
- Built RAG knowledge base for business-specific Q&A

#### Guided Tour System (Aug 27 — Aug 28)
- Implemented guided tour for all 4 roles with data-tour attributes
- Fixed tour showing only once per user via localStorage flag
- Added replay tour button in Settings

#### Dashboard & Routing Updates (Aug 27 — Aug 28)
- Updated routing structure for all new pages
- Enhanced owner dashboard with skeleton loading for KPIs
- Fixed new users getting empty dashboard with demo data seeding
- Added RBAC fixes across multiple routes

#### Anomaly Detection Enhancement (Aug 28)
- Fixed ESLint errors across anomaly page (immutable useMemo, async effect)
- Fixed landing page hero fills viewport, removed nav border, cleaned theme toggle
- Cleaned up corrupted .gitignore file

#### AI Page Improvements (Aug 23)
- Enhanced dashboards with AI insights
- Upgraded anomaly detection with business rule integration
- Improved RFM segmentation visualization

#### ML Model Integration (Aug 28)
- Merged Kavya's unusual sales and inventory anomaly detection
- Merged Pallavi's churn prediction module
- Merged Pramodh's ML training pipeline and revenue prediction
- Resolved all merge conflicts between 4 team members

### Key Commits
```
Aug 23 — Enhance dashboards, AI insights, and anomaly detection
Aug 27 — Add activity backend, comparison, dashboards, and AI updates
Aug 27 — feat: add activity log, global search, skeleton loading, toast notifications
Aug 27 — feat: upgrade chatbot with natural text replies, auto-speak TTS, RAG knowledge base
Aug 27 — feat: add guided tour for all 4 roles with data-tour attributes
Aug 27 — feat: update routing, layout, customer page, and registration flow
Aug 27 — fix: anomaly page ESLint errors - immutable useMemo, async effect fetch
Aug 27 — fix: landing page hero fills viewport, remove nav border, clean theme toggle
Aug 27 — fix: clean up corrupted .gitignore file
Aug 28 — feat: add skeleton loading animation for owner dashboard KPIs
Aug 28 — feat: add replay tour button and profile updates in settings
Aug 28 — feat: add activity log, global search, skeleton loading, toast notifications
Aug 28 — fix: new users get empty dashboard, RBAC fixes, tour status backend sync
Aug 28 — fix: guided tour shows only once per user via localStorage flag
Aug 28 — Merge Kavya's unusual sales and inventory anomaly detection
Aug 28 — Merge Pallavi's churn prediction module
Aug 28 — Merge Pramodh's ML training pipeline and revenue prediction
```

### Bugs Fixed in Milestone 2
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 5 | Churn predictions returning 0 | ttl_cache caching empty result | Restart backend, verify ML pipeline |
| 6 | Anomaly detection false positives | Thresholds too low (2σ) | Tightened to 2.5σ + business rules |
| 7 | Merge conflicts from 4 branches | Overlapping files | Manual resolution of 15+ conflicts |
| 8 | ChatBot gives useless answers | No knowledge base | Built RAG with business Q&A pairs |
| 9 | Tour shows multiple times | No persistence | localStorage flag check |

---

## Milestone 3: Platform Features, PWA & i18n (Sep 3 — Sep 4)
**Week 5 & 6 — Recommendation System & Anomaly Detection Enhancement**

### My Contributions

#### 5-Language i18n System (Sep 3)
- Added centralized translation file with 5 languages (English, Hindi, Telugu, Tamil, Kannada)
- Built LanguageSwitcher component with flag dropdown
- Translated key UI labels across Dashboard, Anomalies, Sales, and Recommendations pages

#### PWA Setup (Sep 3)
- Created web manifest with app metadata
- Built service worker with offline caching
- Generated app icons in all sizes (72-512px)
- Built InstallBanner with platform-specific install instructions (Chrome, Android, iOS)
- Added custom SVG logo with gradient M mark

#### Real-Time WebSocket Alerts (Sep 3)
- Built backend WebSocket endpoint for real-time alert broadcasting
- Created AlertBroadcaster class managing per-business connections
- Implemented LiveAlerts component with toast notifications
- Added browser push notification support

#### Report Templates & Export (Sep 3)
- Built 6 report templates (Sales, Inventory, Customer, Financial, Anomaly, AI)
- Implemented PDF export using jspdf + html2canvas
- Implemented Excel export using xlsx library
- Added live preview modal for each template

#### Scheduled Reports (Sep 3)
- Built full scheduling UI with CRUD operations
- Added daily/weekly/monthly frequency selection
- Implemented PDF/Excel/Both format options
- Added email recipients configuration
- Built delivery history tracking

#### Dashboard Builder (Sep 3)
- Built drag-and-drop dashboard builder with react-grid-layout
- Implemented 7 widget types (Revenue, Performance, KPIs, Top Customers, Category, Inventory, AI)
- Created 3 layout templates (Executive, Sales Focus, Operations)
- Added layout save/restore to Neon PostgreSQL

#### Security Features (Sep 3)
- Added TOTP 2FA with QR code setup and 10 backup codes
- Restructured Settings page into Profile/Security/Preferences tabs
- Implemented Change Password form with validation

#### Onboarding & Compliance (Sep 3)
- Built 5-step onboarding wizard (Welcome → Business Setup → Preferences → Import → Completion)
- Fixed GuidedTour sequencing to wait for onboarding completion
- Added Audit Trail page with IP-logged action tracking
- Created 6 Neon tables for user data (layouts, templates, reports, chat, history)

#### UX Enhancements (Sep 4)
- Added Ctrl+K Command Palette for quick navigation
- Implemented Error Boundary for graceful error handling
- Built QR Code Generator for products and invoices
- Added Undo/Redo context (later removed as incomplete)

#### Dependencies & Config (Sep 3)
- Added react-grid-layout, qrcode.react, i18next to package.json
- Updated Vite config for proper chunk splitting

### Key Commits
```
Sep 3 — feat(i18n): add centralized translation file with 5 languages (EN, HI, TA, TE, KN)
Sep 3 — feat(i18n): add LanguageSwitcher component with flag dropdown
Sep 3 — feat(pwa): add web manifest, service worker, and offline caching
Sep 3 — feat(pwa): add app icons in all sizes and custom SVG logo
Sep 3 — feat(pwa): add InstallBanner with platform-specific install instructions
Sep 3 — chore(deps): add react-grid-layout, qrcode.react, i18next and update vite config
Sep 3 — feat(backend): add WebSocket endpoint for real-time alert broadcasting
Sep 3 — feat(alerts): add WebSocket-powered LiveAlerts with toast notifications
Sep 3 — feat(dashboard): add drag-and-drop dashboard builder backed by Neon
Sep 3 — feat(reports): add 6 report templates with PDF/Excel export
Sep 3 — feat(reports): add scheduled report delivery with CRUD and history
Sep 3 — feat(onboarding): add 5-step setup wizard and fix tour sequencing
Sep 3 — feat(security): add TOTP 2FA with QR setup and restructure Settings into tabs
Sep 3 — feat(compliance): add Audit Trail page with action tracking and IP logging
Sep 4 — feat(neon): add 6 Neon tables and /api/user-data CRUD endpoints
Sep 4 — feat(analytics): add Funnel Analysis page and business rule anomaly module
Sep 4 — feat(ux): add Ctrl+K command palette, error boundary, and QR code generator
Sep 4 — feat(ux): add Undo/Redo context and floating controls
Sep 4 — feat(layout): add mobile sidebar, unified notifications, and new routes
Sep 4 — feat(i18n+responsive): apply translations, responsive fixes, Neon migrations
```

### Bugs Fixed in Milestone 3
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 10 | Scheduled Reports don't save | _get_bid() returns None + wrong IDs | Decode JWT directly + validate numeric IDs |
| 11 | Install modal won't open | CustomEvent not reaching listener | Global window function approach |
| 12 | Dashboard Builder empty | No default template fallback | Load Executive template on empty |
| 13 | i18n crashes entire app | Missing quote in Hindi | Fixed syntax in translation block |

---

## Milestone 4: Bug Fixes, Testing & Production Readiness (Sep 4 — Sep 5)
**Week 7 & 8 — Testing, Deployment & Documentation**

### My Contributions

#### Sales Server-Side Pagination (Sep 5)
- Added limit/offset params to GET /api/sales/ endpoint
- Built paginated table with page navigation controls
- Export handlers fetch all data for complete PDF/Excel/CSV exports

#### Backend Security Hardening (Sep 5)
- Added JWT_SECRET_KEY to .env and .env.example
- Made CORS_ORIGINS configurable via environment variable
- Added Neon connection pool keepalive and retry

#### Backend Bug Fixes (Sep 5)
- Registered missing activity router in main.py (was returning 404)
- Rewrote activity router to use AuditLog model (Activity model didn't exist)
- Replaced 11 empty catch blocks with proper logging across 6 files
- Simplified migration script for Neon
- Fixed warm-up function name (get_product_recommendations → get_all_recommendations)

#### Frontend Crash Fixes (Sep 5)
- Fixed 7 pages crashing from paginated sales data format change
- Added missing PageSkeleton import to 12 pages
- Cleaned up dead Undo/Redo imports from Customers.jsx
- Fixed Comparison and Customers pages loading states

#### CORS Fix (Sep 5)
- Added 127.0.0.1 variants to CORS_ORIGINS
- Backend now accepts requests from both localhost and 127.0.0.1

#### Mobile Responsiveness (Sep 5)
- Added mobile hamburger sidebar toggle
- Sidebar slides in as overlay on mobile with dark backdrop
- Auto-closes on route navigation

#### UI Improvements (Sep 5)
- Added useCountUp animation hook for KPI cards
- Added skeleton loading placeholders and empty states
- Restructured Settings page tabs
- Updated SVG logo with gradient M mark
- Removed incomplete Undo/Redo system

#### Documentation (Sep 5)
- Updated README with accurate project description and setup
- Fixed README UTF-8 encoding corruption
- Added .env.example with all required variables
- Cleaned .gitignore (removed .freebuff references)

#### Comprehensive Testing (Sep 5)
- Tested all 4 roles across 15 API endpoints each (60 total tests)
- Verified Neon data isolation between businesses
- Tested all CRUD operations end-to-end
- Verified role-based access control on all pages
- Confirmed all AI/ML endpoints return correct data

### Key Commits
```
Sep 5 — fix(security): add JWT_SECRET_KEY to .env and .env.example
Sep 5 — fix(backend): make CORS_ORIGINS configurable via env variable
Sep 5 — fix(backend): register missing activity router in main.py
Sep 5 — fix(backend): rewrite activity router to use AuditLog model
Sep 5 — fix(backend): correct warm-up function name in startup task
Sep 5 — fix(backend): add logging to empty catch blocks in auth and sales
Sep 5 — fix(backend): replace empty except blocks with proper logging
Sep 5 — fix(backend): add Neon connection pool keepalive and retry
Sep 5 — refactor(backend): simplify migration script for Neon
Sep 5 — feat(sales): add server-side pagination with 50 records per page
Sep 5 — fix(reports): fix scheduled reports not saving to Neon
Sep 5 — fix(frontend): fix Customers page crash from paginated sales data
Sep 5 — fix(frontend): handle paginated sales in Comparison and Funnel
Sep 5 — fix(frontend): handle paginated sales in ReportTemplates
Sep 5 — fix(dashboard-builder): handle paginated sales data + default template
Sep 5 — fix(frontend): handle paginated sales in ChatBot
Sep 5 — fix(frontend): add missing PageSkeleton import to 5 pages
Sep 5 — fix(frontend): add missing PageSkeleton import to 6 more pages
Sep 5 — feat(layout): add mobile hamburger sidebar toggle
Sep 5 — fix(pwa): fix install modal not opening from header
Sep 5 — feat(branding): update SVG logo with gradient M mark
Sep 5 — feat(frontend): add useCountUp animation hook and loading spinner
Sep 5 — feat(frontend): add skeleton loading placeholders and empty states
Sep 5 — feat(dashboard): add animated count-up numbers on KPI cards
Sep 5 — refactor(settings): restructure into Profile/Security/Preferences tabs
Sep 5 — refactor: remove incomplete Undo/Redo system
Sep 5 — docs: update README with accurate project description and setup
Sep 5 — chore: clean .gitignore — add *.log, remove .freebuff references
Sep 5 — fix(i18n): fix Hindi translation syntax error
Sep 5 — fix(frontend): clean up Comparison and Customers pages
Sep 5 — docs: fix README UTF-8 encoding corruption
```

### Bugs Fixed in Milestone 4
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 14 | 7 pages crash after pagination | sales.filter on object not array | Array.isArray fallback in all consumers |
| 15 | Activity router 500 error | Wrong model (Activity → AuditLog) | Complete rewrite with correct columns |
| 16 | Role logins failing | Wrong field (password_hash → hashed_password) | Reset all passwords with correct field |
| 17 | CORS blocking browser requests | Missing 127.0.0.1 origins | Added localhost + 127.0.0.1 variants |
| 18 | Warm-up warnings on startup | Wrong function name | Fixed to get_all_recommendations |
| 19 | 11 empty catch blocks hiding bugs | Silent except-pass | All now log warnings with context |

---

## Complete Commit History

| Milestone | Date Range | Commits | Key Deliverables |
|-----------|-----------|:-------:|------------------|
| **Milestone 1** | Jul 24 — Aug 11 | 18 | Auth, CRUD pages, 3D landing, AI pages, Neon migration |
| **Milestone 2** | Aug 11 — Aug 28 | 17 | Activity log, ChatBot AI, Guided Tour, ML merges |
| **Milestone 3** | Sep 3 — Sep 4 | 20 | i18n, PWA, WebSocket, Reports, Dashboard Builder, 2FA |
| **Milestone 4** | Sep 4 — Sep 5 | 31 | 16 bug fixes, pagination, security, testing, documentation |
| **Total** | Jul 24 — Sep 5 | **86** | **Full-stack AI platform with 28+ pages** |

---

## API Test Results (Sep 5, 2026)

| Role | Credentials | Endpoints Tested | Passed | Failed |
|------|------------|:---:|:---:|:---:|
| Business Owner | neelamrishikadamini@gmail.com | 15 | 15 | 0 |
| Store Manager | manager@marketmind.ai | 15 | 15 | 0 |
| Sales Executive | sales@marketmind.ai | 15 | 15 | 0 (403 on AI = expected) |
| Admin | admin@marketmind.ai | 15 | 15 | 0 |

### Verified Neon Data
| Data | Count |
|------|-------|
| Products | 12 |
| Customers | 20 |
| Sales | 583 |
| Invoices | 15 |
| Categories | 5 |
| Suppliers | 4 |
| AI Forecast | 7-day predictions |
| Segmentation | 4 segments, 20 customers |
| Churn | 20 predictions |
| Anomalies | 50 alerts |
| CLV | 20 predictions |
| Activity Logs | Login entries |

---

## Technologies Used

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI with code splitting |
| Styling | Tailwind CSS | Dark/light mode |
| State | React Context | Auth, Theme, i18n |
| Routing | React Router v6 | Role-based guards |
| Charts | Recharts | Data visualizations |
| Dashboard | react-grid-layout | Drag-and-drop widgets |
| i18n | react-i18next | 5-language translations |
| PDF | jspdf + html2canvas | Report export |
| Excel | xlsx | Spreadsheet export |
| QR | qrcode.react | QR codes |
| Backend | FastAPI + SQLAlchemy | Async Python API |
| Auth | python-jose + bcrypt | JWT + hashing |
| ML | scikit-learn + XGBoost | K-Means, Logistic, XGBoost |
| Real-time | WebSocket | Live alerts |
| Database | Neon PostgreSQL | 28 tables, connection pooling |

---

## Database Schema (28 Tables)

**Core:** users, businesses, customers, products, sales, sale_items, invoices, categories, suppliers, inventory, inventory_transactions

**AI/ML:** forecasts, churn_predictions, product_recommendations, customer_segments

**Analytics:** anomaly_alerts, inventory_alerts, notifications

**Platform:** audit_logs, dashboard_layouts, custom_report_templates, scheduled_reports, prediction_history, chat_history, uploaded_datasets, alembic_version

---

## Key Learnings

1. **Multi-tenant architecture** — Every query must filter by business_id
2. **Backend changes ripple to frontend** — Changing response format broke 7 pages
3. **Merge conflicts need clear file ownership** — 4 developers caused 15+ conflicts
4. **Error handling is not optional** — 11 empty except blocks hid real bugs
5. **CORS is browser-specific** — localhost and 127.0.0.1 are different origins
6. **ML models need real data** — Synthetic data produces perfect but meaningless metrics
7. **PWA requires HTTPS** — Install prompts only work on HTTPS or localhost
8. **SQLAlchemy field names matter** — password_hash vs hashed_password causes silent failures

---

*Report prepared by Neelam Rishika Damini | Team 2 — MarketMind AI | Infosys Springboard Capstone Project*
