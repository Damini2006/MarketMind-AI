import os
import time
import random
import smtplib
import datetime as dt
from collections import defaultdict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

# Simple in-memory rate limiter for auth endpoints
_rate_store = defaultdict(list)

def _check_rate_limit(key: str, max_attempts: int = 5, window: int = 300):
    """Reject if more than max_attempts in window seconds."""
    now = time.time()
    _rate_store[key] = [t for t in _rate_store[key] if now - t < window]
    if len(_rate_store[key]) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {window}s.",
        )
    _rate_store[key].append(now)

from .. import models, schemas
from ..cache import invalidate
from ..database import get_db
from ..seed_data import seed_business_demo_data
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from ..deps import get_current_user

# --- Correct Prefix with /api/auth ---
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


def send_email_otp(target_email: str, otp_code: str):
    """Utility function to deliver the 6-digit OTP code to the user's email inbox."""
    # Fetch environment variables dynamically inside the function
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    if not sender_email or not sender_password:
        raise ValueError("SENDER_EMAIL or SENDER_PASSWORD environment variable is missing.")

    message = MIMEMultipart("alternative")
    message["Subject"] = "MarketMind AI - Your Password Reset OTP"
    message["From"] = f"MarketMind AI <{sender_email}>"
    message["To"] = target_email

    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #2e2b8f; margin-top: 0;">Password Reset Code</h2>
          <p>You requested a password reset for your MarketMind AI account. Use the OTP code below to set a new password:</p>
          <div style="background-color: #f4f4f9; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 12px; margin: 20px 0; border-radius: 8px; color: #2e2b8f;">
            {otp_code}
          </div>
          <p style="font-size: 12px; color: #777;">This code is valid for 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      </body>
    </html>
    """

    message.attach(MIMEText(body_html, "html"))

    # Connect to Google SMTP server and send email
    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, target_email, message.as_string())


# --- Request Schemas ---
class ProfileUpdateRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    preferred_currency: Optional[str] = None
    timezone: Optional[str] = None
    avatar_color: Optional[str] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class SendOTPRequest(BaseModel):
    email: EmailStr


class ResetPasswordOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


# --- Core Auth Routes ---

@router.post(
    "/register",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"register:{ip}", max_attempts=5, window=300)

    existing = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email address is already registered",
        )

    # Multi-tenant registration: each signup creates its own business,
    # and the person who registers becomes that business's owner.
    business = models.Business(company_name=payload.company_name)
    db.add(business)
    db.flush()

    user = models.User(
        full_name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        business_id=business.id,
    )
    db.add(user)
    db.flush()
    db.commit()

    # Auto-seed demo data so new users see a populated dashboard
    try:
        import random as _rnd, datetime as _dt
        bid = business.id
        _cats = ['Groceries', 'Electronics', 'Clothing', 'Home & Kitchen', 'Personal Care']
        for c in _cats:
            db.add(models.Category(category_name=c, business_id=bid))
        _prods = [
            ('Whole Wheat Atta 10kg', 480, 50, 1), ('Basmati Rice 5kg', 650, 35, 1),
            ('Sunflower Oil 1L', 180, 80, 1), ('Toothpaste Pack', 120, 60, 5),
            ('Notebook 200pg', 80, 100, 4), ('USB Cable', 250, 40, 2),
            ('Rice Cooker', 2500, 15, 2), ('Cotton T-Shirt', 350, 50, 3),
            ('Dish Soap 1L', 150, 70, 5), ('Pressure Cooker 5L', 1800, 20, 2),
        ]
        prod_ids = []
        for name, price, stock, cat_id in _prods:
            p = models.Product(name=name, price=price, stock_quantity=stock, business_id=bid)
            db.add(p); db.flush(); prod_ids.append(p.id)
        cust_names = ['Amit Sharma','Priya Patel','Ravi Kumar','Sneha Gupta','Vikram Singh','Anjali Reddy','Rohit Verma','Neha Kulkarni','Deepak Nair','Kavita Joshi','Suresh Iyer','Meera Das','Arjun Rao','Divya Menon','Rajesh Pillai']
        cust_ids = []
        for n in cust_names:
            c = models.Customer(name=n, email=f"{n.split()[0].lower()}@example.com", business_id=bid)
            db.add(c); db.flush(); cust_ids.append(c.id)
        ref = _dt.date(2026, 7, 1)
        for i in range(50):
            day = ref + _dt.timedelta(days=_rnd.randint(0, 60))
            db.add(models.Sale(
                product_id=_rnd.choice(prod_ids), customer_id=_rnd.choice(cust_ids),
                quantity=_rnd.randint(1, 10), unit_price=round(_rnd.uniform(80, 2500), 2),
                total_amount=round(_rnd.uniform(200, 15000), 2),
                sale_date=_dt.datetime.combine(day, _dt.time(9, 0)),
                business_id=bid))
        db.commit()
    except Exception as e:
        import sys; print(f"SEED ERROR: {e}", file=sys.stderr, flush=True)
        try: db.rollback()
        except: pass

    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"login:{ip}", max_attempts=10, window=300)

    user = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": role_str,
        }
    )

    # Log the login action to audit trail
    try:
        from .audit import log_action
        log_action(
            db=db,
            action="Logged in",
            action_type="login",
            resource="Auth",
            user_id=user.id,
            user_name=user.full_name,
            business_id=user.business_id,
            details=f"Login via email: {payload.email}",
        )
    except Exception as exc:
        import logging
        logging.warning(f"Audit log failed during login: {exc}")  # Don't block login if audit fails

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.UserOut)
def me(
    current_user: models.User = Depends(get_current_user),
):
    return current_user


@router.put("/profile", response_model=schemas.UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Drop the user cache entry BEFORE mutating the shared cached object.
    invalidate(f"user:{current_user.id}")
    existing = (
        db.query(models.User)
        .filter(models.User.email == payload.email, models.User.id != current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email address is already in use",
        )

    current_user.full_name = payload.full_name
    current_user.email = payload.email
    current_user.phone = payload.phone  # None clears the field
    current_user.bio = payload.bio  # None clears the field
    if payload.preferred_currency is not None:
        current_user.preferred_currency = payload.preferred_currency
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    if payload.avatar_color is not None:
        current_user.avatar_color = payload.avatar_color

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    invalidate(f"user:{current_user.id}")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Incorrect current password",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}


# --- OTP Password Reset Routes ---

@router.post("/send-otp")
def send_otp(
    payload: SendOTPRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not user:
        return {"message": "If an account with that email exists, an OTP code has been sent."}

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))

    # Save OTP & set 15-minute expiry
    user.reset_otp = otp
    user.reset_otp_expiry = dt.datetime.utcnow() + dt.timedelta(minutes=15)
    db.commit()

    # Send Real Email via SMTP
    try:
        send_email_otp(payload.email, otp)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP email: {str(e)}"
        )

    return {"message": f"OTP code sent to {payload.email}."}


@router.post("/reset-password-otp")
def reset_password_otp(
    payload: ResetPasswordOTPRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not user or not user.reset_otp or user.reset_otp != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code or email.",
        )

    if user.reset_otp_expiry < dt.datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new code.",
        )

    # Update password and clear reset OTP fields
    user.hashed_password = hash_password(payload.new_password)
    user.reset_otp = None
    user.reset_otp_expiry = None
    db.commit()

    return {"message": "Password reset successfully."}