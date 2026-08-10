import os
import random
import smtplib
import datetime as dt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
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

    # Seed demo data (products, customers, sales, invoices) so a brand-new
    # business is not an empty dashboard. seed_business_demo_data commits.
    seed_business_demo_data(db, business)

    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
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