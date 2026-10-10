<div align="center">

<img src="frontend/public/logo.svg" alt="MarketMind AI Logo" width="120" />

# MarketMind AI

### Small Business Sales Intelligence & Analytics Platform

[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00A87E?logo=postgresql)](https://neon.tech)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

**AI-powered business intelligence platform for Indian small businesses.**

</div>

---

## Overview

MarketMind AI is a full-stack SaaS application built to give small retail businesses access to enterprise-grade analytics. A React frontend communicates with a FastAPI backend, backed by Neon PostgreSQL, delivering real-time insights across sales, inventory, customers, and finances — with ML models for forecasting, anomaly detection, and recommendations.

### Highlights

- 28+ pages covering sales, inventory, customers, invoices, analytics, and AI
- 5-language support — English, Hindi, Telugu, Tamil, Kannada
- Role-based access — Business Owner, Store Manager, Sales Executive, Admin
- Neon PostgreSQL — serverless database with connection pooling
- PWA — installable on mobile and desktop with offline caching
- Real-time alerts — WebSocket-powered live notifications

---

## Features

### Core Business Modules

| Module | Description |
|--------|-------------|
| Dashboard | Role-based KPIs, revenue trends, top customers, sales charts |
| Sales | Record, track, and analyze revenue with CSV upload support |
| Inventory | Real-time stock tracking, low-stock alerts, reorder recommendations |
| Invoices | Professional invoice generation with QR codes and status tracking |
| Customers | RFM segmentation (High/Medium/Low/At-Risk), CLV prediction |
| Categories & Suppliers | Product organization and supplier management |
| Team | Team member management with role assignment |

### AI & Machine Learning

| Feature | Description |
|---------|-------------|
| Sales Forecasting | XGBoost-based 14/30-day revenue predictions |
| Customer Segmentation | K-Means clustering by Recency, Frequency, Monetary value |
| Churn Prediction | Identify at-risk customers before they leave |
| Anomaly Detection | Statistical outlier detection for unusual transactions |
| Product Recommendations | Collaborative filtering + association rule mining |
| Revenue Prediction | Category-based revenue forecasting with seasonality |

### Analytics & Reporting

| Feature | Description |
|---------|-------------|
| Report Templates | 6 pre-built templates (Sales, Inventory, Customer, Financial, Anomaly, AI) |
| Scheduled Reports | Daily/weekly/monthly automated report delivery |
| Dashboard Builder | Drag-and-drop customizable dashboard with 7 widget types |
| Funnel Analysis | Customer journey tracking with conversion rates |
| Comparison | Side-by-side period-over-period analytics |
| Export to PDF/Excel | One-click export from any page |

### Platform Features

| Feature | Description |
|---------|-------------|
| Multi-Language (i18n) | English, Hindi, Telugu, Tamil, Kannada — full app translation |
| Dark/Light Mode | System-aware theme with manual toggle |
| PWA | Installable on mobile/desktop with offline caching |
| Real-Time Alerts | WebSocket live notifications with browser push support |
| Command Palette | Ctrl+K quick navigation across all pages |
| Audit Trail | IP-logged action tracking stored in Neon |
| 2FA (TOTP) | Authenticator app support with backup codes |
| Onboarding Wizard | 5-step guided setup flow for new users |
| AI Chatbot | Natural language business queries |
| QR Code Generator | Product and invoice QR codes |

---

## Tech Stack

### Frontend

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework with lazy-loaded routes |
| Vite | Build tool with HMR and code splitting |
| Tailwind CSS | Utility-first styling with dark mode |
| React Router v6 | Client-side routing with role-based guards |
| Recharts | Interactive data visualizations |
| react-grid-layout | Drag-and-drop dashboard builder |
| react-i18next | Internationalization framework |
| jspdf + html2canvas | PDF export |
| xlsx | Excel export |
| qrcode.react | QR code generation |

### Backend

| Technology | Purpose |
|-----------|---------|
| FastAPI | Async Python web framework |
| SQLAlchemy | ORM with connection pooling |
| Pydantic v2 | Data validation and serialization |
| python-jose | JWT token handling |
| bcrypt | Password hashing |
| scikit-learn | ML models (K-Means, Isolation Forest) |
| XGBoost | Sales forecasting model |
| WebSocket | Real-time alert broadcasting |

### Database

| Technology | Purpose |
|-----------|---------|
| Neon PostgreSQL | Serverless cloud database |
| 28 tables | Full relational schema with FK indexes |
| Connection pooling | SQLAlchemy pool against Neon's direct endpoint |

---

## Architecture

```
Frontend (React 18 + Vite + Tailwind CSS)
    |
    v
Backend (FastAPI + SQLAlchemy + Python)
    |
    v
Neon PostgreSQL (28 tables, connection pooling, SSL)
```

```
Frontend                          Backend                         Database
+------------------+       +------------------+        +------------------+
| Dashboard        |       | Auth Router      |        |                  |
| Sales            |       | Sales Router     |        |  Neon PostgreSQL |
| Inventory        | <---> | Inventory Router | <--->  |  28 Tables       |
| AI/ML Insights   |  API  | Analytics Router |  ORM   |  Connection Pool |
| Reports          |       | AI Engine        |        |  SSL + Auto-scale|
| Dashboard Builder|       | WebSocket Alerts |        |                  |
+------------------+       +------------------+        +------------------+
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Neon account (free tier works) for PostgreSQL database
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/springboardmentor24052s-tech/Team_2_Small_Biz_AI.git
cd Team_2_Small_Biz_AI
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Neon database URL and other settings
```

**Required `.env` variables:**

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `JWT_SECRET_KEY` | Random secret for JWT tokens (auto-generated if empty) | Recommended |
| `CORS_ORIGINS` | Comma-separated frontend URLs | No (defaults to localhost) |
| `SENDER_EMAIL` | Gmail for OTP password reset | Optional |
| `SENDER_PASSWORD` | Gmail app password | Optional |

```bash
# Start the backend server
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000` | API docs at `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 4. First Login

1. Open `http://localhost:5173`
2. Click **Sign Up** and create an account with role **Business Owner**
3. Complete the onboarding wizard
4. Start adding products, sales, and customers

---

## Project Structure

```
Team_2_Small_Biz_AI/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── security.py              # JWT, password hashing
│   │   ├── ml/
│   │   │   ├── anomaly_detection.py      # Statistical anomaly detection
│   │   │   ├── business_rule_anomalies.py
│   │   │   ├── inference.py              # ML model inference
│   │   │   ├── recommendations.py        # Collaborative filtering
│   │   │   └── forecasting.py            # XGBoost sales forecasting
│   │   ├── routers/
│   │   │   ├── auth.py                   # Login, register, OTP, password reset
│   │   │   ├── sales.py                  # Sales CRUD + CSV upload
│   │   │   ├── inventory.py              # Products, stock management
│   │   │   ├── customers.py              # Customer CRUD + segmentation
│   │   │   ├── invoices.py               # Invoice generation
│   │   │   ├── analytics.py              # KPIs, charts, aggregation
│   │   │   ├── ai.py                     # AI endpoints (forecast, churn, etc.)
│   │   │   ├── audit.py                  # Audit trail logging
│   │   │   ├── websocket_alerts.py       # Real-time alert broadcasting
│   │   │   └── ...                       # 19 router files total
│   │   ├── models.py                     # SQLAlchemy models (28 tables)
│   │   ├── schemas.py                    # Pydantic validation schemas
│   │   ├── database.py                   # Neon PostgreSQL engine
│   │   └── main.py                       # FastAPI app, middleware, startup
│   ├── .env.example                      # Environment variable template
│   └── requirements.txt                  # Python dependencies
│
├── frontend/
│   ├── public/
│   │   ├── manifest.json                 # PWA manifest
│   │   ├── sw.js                         # Service worker
│   │   └── icon-*.png                    # App icons (72-512px)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx                # Sidebar + header layout
│   │   │   ├── ChatBot.jsx               # AI chatbot overlay
│   │   │   ├── LiveAlerts.jsx            # WebSocket alert notifications
│   │   │   ├── LanguageSwitcher.jsx      # 5-language selector
│   │   │   ├── OnboardingWizard.jsx      # 5-step setup wizard
│   │   │   ├── CommandPalette.jsx        # Ctrl+K search
│   │   │   └── ...                       # 15+ reusable components
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx             # Main dashboard
│   │   │   ├── Sales.jsx                 # Sales management
│   │   │   ├── Inventory.jsx             # Product & stock management
│   │   │   ├── Anomalies.jsx             # Anomaly detection dashboard
│   │   │   ├── DashboardBuilder.jsx      # Drag-and-drop dashboard builder
│   │   │   ├── ReportTemplates.jsx       # Report templates + export
│   │   │   └── ...                       # 27 page files total
│   │   ├── context/
│   │   │   ├── AuthContext.jsx           # Authentication state
│   │   │   └── ThemeContext.jsx          # Dark/light mode
│   │   ├── i18n.js                       # 5-language translations
│   │   ├── App.jsx                       # Router + lazy loading
│   │   └── main.jsx                      # App entry point
│   ├── package.json                      # Node dependencies
│   └── vite.config.js                    # Vite build config
│
└── README.md
```

---

## Database Schema

MarketMind AI uses **28 PostgreSQL tables** on Neon.

**Core Tables**
`users` | `businesses` | `customers` | `products` | `sales` | `sale_items` | `invoices` | `categories` | `suppliers` | `inventory` | `inventory_transactions`

**AI/ML Tables**
`forecasts` | `churn_predictions` | `product_recommendations` | `customer_segments`

**Analytics Tables**
`anomaly_alerts` | `inventory_alerts` | `notifications`

**Platform Tables**
`audit_logs` | `dashboard_layouts` | `custom_report_templates` | `scheduled_reports` | `prediction_history` | `chat_history` | `uploaded_datasets` | `alembic_version`

All foreign key columns are indexed for query performance.

---

## Role-Based Access Control

| Feature | Business Owner | Store Manager | Sales Executive | Admin |
|---------|:-:|:-:|:-:|:-:|
| Dashboard | Yes | Yes | Yes | Yes |
| Sales | Yes | Yes | Yes | Yes |
| Inventory | Yes | Yes | Yes | Yes |
| Invoices | Yes | Yes | Yes | Yes |
| Customers | Yes | Yes | Yes | Yes |
| Categories | Yes | Yes | No | Yes |
| Suppliers | Yes | Yes | No | Yes |
| Team | Yes | No | No | Yes |
| Datasets | Yes | No | No | Yes |
| Forecasting | Yes | Yes | No | Yes |
| Segmentation | Yes | Yes | Yes | Yes |
| Churn | Yes | Yes | No | Yes |
| Recommendations | Yes | Yes | Yes | Yes |
| Anomalies | Yes | Yes | No | Yes |
| Revenue Prediction | Yes | Yes | No | Yes |
| Dashboard Builder | Yes | No | No | Yes |
| Report Templates | Yes | No | No | Yes |
| Settings | Yes | Yes | Yes | Yes |

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get JWT token |
| POST | `/api/auth/send-otp` | Send password reset OTP |
| POST | `/api/auth/reset-password-otp` | Reset password with OTP |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Business Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/sales/` | List/create sales |
| GET/POST | `/api/inventory/products` | List/create products |
| GET/POST | `/api/customers/` | List/create customers |
| GET/POST | `/api/invoices/` | List/create invoices |
| GET/POST | `/api/categories/` | List/create categories |
| GET/POST | `/api/suppliers/` | List/create suppliers |

### AI & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/forecast` | Sales forecasting (14/30 day) |
| GET | `/api/ai/segmentation` | Customer segmentation |
| GET | `/api/ai/churn` | Churn predictions |
| GET | `/api/ai/anomalies` | Anomaly detection |
| GET | `/api/ai/recommendations` | Product recommendations |
| GET | `/api/analytics/kpis` | Dashboard KPIs |
| GET | `/api/analytics/charts` | Chart data |

### Platform

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/logs` | Audit trail |
| WS | `/ws/alerts/{business_id}` | Real-time alerts |
| GET/POST | `/api/user-data/dashboard-layouts` | Dashboard layouts |
| GET/POST | `/api/user-data/report-templates` | Report templates |
| GET/POST | `/api/user-data/scheduled-reports` | Scheduled reports |

Full interactive API documentation at `http://localhost:8000/docs`

---

## Security

- JWT authentication with 12-hour token expiry
- bcrypt password hashing with salt
- Rate limiting — Login: 10 attempts/5min, Register: 5 attempts/5min per IP
- Role-based access control (RBAC) on all endpoints
- CORS protection — configurable allowed origins
- OTP email verification for password resets
- TOTP 2FA with QR code setup and backup codes
- Audit trail — all actions logged with IP address
- No secrets in code — all sensitive values via environment variables

---

## Performance

| Metric | Value |
|--------|-------|
| Initial bundle size | ~590 KB (gzipped ~178 KB) |
| Code splitting | 27 lazy-loaded route chunks |
| API caching | TTL-based cache for KPIs, sales, analytics |
| DB indexes | All 31 foreign key columns indexed |
| GZip compression | Enabled for responses >1KB |
| Connection pooling | Neon serverless, direct endpoint + SQLAlchemy pool |

---

## Deployment

The app is two deployables: a FastAPI backend (any Python host or the provided `backend/Dockerfile`) and a Vite static frontend. See [`DEPLOY.md`](DEPLOY.md) for the step-by-step Railway + Vercel + Neon walkthrough.

### Backend (Railway / Render / Fly.io / Docker)

1. Provision a **Neon PostgreSQL** database and copy its connection string. Use the **direct** endpoint — drop the `-pooler` label from the host (e.g. `ep-xxx-pooler.c-4.us-east-2.aws.neon.tech` -> `ep-xxx.c-4.us-east-2.aws.neon.tech`), or remove it from the host if Neon only shows you the pooled one. This backend is a single long-lived server with its own SQLAlchemy connection pool, which is the case Neon's pooler is not for; going direct also avoids PgBouncer's transaction-mode caveats. See the comment above `create_engine` in `backend/app/database.py`.
2. Set environment variables on the host:
   - `ENVIRONMENT` — set to `production`. This is the switch that makes the
     backend take itself seriously: it **refuses to start** without a real
     `JWT_SECRET_KEY` and stops seeding the demo accounts (whose passwords are
     published in this repo). Anything other than `production`/`prod` behaves
     like a development machine.
   - `DATABASE_URL` — Neon direct URL, `?sslmode=require` (required)
   - `JWT_SECRET_KEY` — strong random secret ≥ 32 chars (required; a placeholder
     is rejected, not silently accepted). Generate with
     `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   - `ACCESS_TOKEN_EXPIRE_MINUTES` — optional, access-token lifetime (default 180 = 3h; deliberately short — the browser silently renews via `POST /api/auth/refresh`)
   - `REFRESH_TOKEN_EXPIRE_DAYS` — optional, refresh-cookie lifetime (default 30). Refresh tokens rotate on every use and are revoked on logout/password change; replaying a rotated token revokes the whole session family.
   - `CORS_ORIGINS` — **must include your deployed frontend origin**, e.g. `https://your-app.vercel.app` (defaults to localhost only). `*` is refused, because credentials are allowed.
   - `SENDER_EMAIL` / `SMTP_SERVER` / `SMTP_PORT` / `SENDER_PASSWORD` — optional, enables OTP password-reset emails

   Variables that are read but need no production value: `SEED_DEMO_DATA`
   (defaults on outside production, off in it — set `true` only for a staging
   environment that may hold the published demo passwords) and
   `BACKEND_PORT` / `FRONTEND_PORT` / `BACKEND_ENV_FILE` for the compose stack.
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (tables auto-create; startup warm-up precomputes AI caches).

### Frontend (Vercel / Netlify / static hosting)

1. Build: `npm run build` → publish `dist/`.
2. Same-origin option (no CORS needed): reverse-proxy `/api`, `/uploads` and `/ws` to the backend (see `vite.config.js`'s proxy block for the three prefixes to forward).
3. Split-origin option: set `VITE_API_BASE_URL=https://your-api-host` at build time, and add the frontend origin to the backend's `CORS_ORIGINS`. WebSocket alerts follow `VITE_API_BASE_URL` automatically.
4. SPA routing: add a rewrite of all paths to `/index.html` (Vercel/Netlify do this via framework presets).

### Deploy smoke test

`scripts/smoke_test.py` answers "is the deployed stack actually usable?" rather than "are the containers up?". It makes real HTTP calls and exits non-zero on any failure, so it can gate a deploy:

```bash
# against a local/dev stack
python scripts/smoke_test.py

# against a stack started with docker compose (runs inside its network)
docker compose --profile smoke run --rm smoke

# against a real environment
SMOKE_BACKEND_URL=https://api.example.com \
SMOKE_FRONTEND_URL=https://app.example.com \
SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=... \
python scripts/smoke_test.py
```

It verifies the backend `/health`, the `/openapi.json` schema, that the frontend serves the SPA shell (not merely that it returns a 200), that nginx proxies `/api` to the backend, that an account can authenticate, that the token works on an authenticated endpoint, that the app reaches its database, and that anonymous callers are rejected with 401.

It is deliberately **not** the container healthcheck: login is rate limited to 10 attempts per IP per 300s, so a check that logged in on a 10s healthcheck interval would be answered with 429. The cheap `curl /health` healthcheck stays as it is.

CI runs the same gate on every push — the `deploy-smoke` job in `.github/workflows/ci.yml` stands the whole stack up against a throwaway PostgreSQL using `docker-compose.ci.yml` (no secrets required) and tears it down afterwards.

### Production checklist

- [ ] `ENVIRONMENT=production` (otherwise the dev conveniences stay on)
- [ ] `DATABASE_URL` points at Neon with `sslmode=require`
- [ ] `JWT_SECRET_KEY` is a fresh ≥ 32-char secret (not the dev value, not a placeholder — startup rejects both)
- [ ] `CORS_ORIGINS` lists the real frontend origin(s) and contains no `*`
- [ ] TLS terminates in front of the stack (the backend speaks plain HTTP)
- [ ] `VITE_API_BASE_URL` set at frontend build time (split deployments)
- [ ] SMTP credentials present if password-reset emails are wanted
- [ ] No demo accounts on the database: with `ENVIRONMENT=production` a fresh
      database starts empty and the first user registers as its owner. If the
      demo tenant was ever seeded, delete `owner@marketmind.ai`,
      `manager@marketmind.ai`, `sales@marketmind.ai` and `admin@marketmind.ai`
- [ ] Smoke-test after deploy: `python scripts/smoke_test.py` (see Deploy smoke test above) — it covers `/health`, the SPA, an authenticated call and the database round-trip. Pass real `SMOKE_EMAIL` / `SMOKE_PASSWORD`, since the defaults are the demo account
- [ ] Read `SECURITY_AND_DEPLOYMENT_REVIEW.md` and work through its P1/P2 list

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Python: Follow PEP 8, use type hints
- JavaScript: Use functional components with hooks
- Commits: Use conventional commits (`feat:`, `fix:`, `chore:`)
- No hardcoded secrets — always use environment variables

---

## License

This project is for educational purposes as part of the Infosys Springboard program.

---

<div align="center">

**Built for Indian Small Businesses**

*MarketMind AI — Making enterprise-grade analytics accessible to every shop owner*

</div>
