# Team_2_Small_Biz_AI

# MarketMind AI - Small Business Sales Intelligence & Analytics Platform
MarketMind AI is a comprehensive, production-ready SaaS application designed to empower small businesses with advanced sales tracking, inventory management, customer segmentation, and AI-driven predictive analytics.

# Key Features
Advanced 3D Animated Landing Page: Interactive product previews, streamlined entry points, and responsive UI.

Secure Authentication & Onboarding: Complete JWT-based registration and login flows.

Secure Password Recovery: 6-digit OTP generation and automated delivery via Gmail SMTP.

Dashboard & Settings: Dark/light mode theme toggling, profile management, and role-based workflows.

# Core Business Modules:

Sales Tracking: Record, monitor, and analyze revenue metrics.

Inventory Management: Real-time stock tracking and alerts.

Customer Profiles & Segmentation: Automated RFM (Recency, Frequency, Monetary) clustering and analysis.

Invoices: Professional invoice generation and management.

# AI & Machine Learning Insights:

Sales Forecasting

Churn Risk Analysis

Anomaly & Fraud Detection Alerts

Smart Product Recommendations

# Tech Stack
Frontend: React, Vite, Tailwind CSS, Lucide Icons, React Router

Backend: FastAPI, Python, Pydantic, SQLAlchemy, Uvicorn

Database: Neon PostgreSQL / SQLite

Authentication: JSON Web Tokens (JWT), Passlib, Gmail SMTP (for OTP)


# Setup & Installation Guide
Prerequisites
Make sure you have Node.js and Python (3.9+) installed on your machine.

1. Backend Setup
Open your terminal and navigate to the backend folder:

Bash
cd backend
Create and activate a Python virtual environment:

Windows (CMD/PowerShell):

Bash
python -m venv venv
venv\Scripts\activate
macOS / Linux:

Bash
python3 -m venv venv
source venv/bin/activate
Install the required Python packages:

Bash
pip install -r requirements.txt
Run the FastAPI development server:

Bash
uvicorn app.main:app --reload
The backend will run locally at: [http://127.0.0.1:8000](http://127.0.0.1:8000)

Interactive API docs (Swagger UI) are available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

2. Frontend Setup
Open a new terminal window and navigate to the frontend folder:

Bash
cd frontend
Install the required Node packages:

Bash
npm install
Start the Vite development server:

Bash
npm run dev
The frontend will run locally at: http://localhost:5173 (or the port specified in your terminal).