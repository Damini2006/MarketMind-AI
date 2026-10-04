import os
import hmac
import secrets
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
    attempts = [t for t in _rate_store[key] if now - t < window]
    if attempts:
        _rate_store[key] = attempts
    else:
        # Drop fully-expired keys so the store cannot grow without bound.
        _rate_store.pop(key, None)
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {window}s.",
        )
    _rate_store[key].append(now)

def _peek_rate_limit(key: str, max_attempts: int, window: int = 300):
    """Raise 429 if the key is over budget WITHOUT recording an attempt.

    Used before password verification for per-account failure counters:
    the counter is only ever filled by real failures (never successes),
    and the pre-check must not itself consume budget.
    """
    now = time.time()
    attempts = [t for t in _rate_store.get(key, []) if now - t < window]
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again later.",
        )

from . import models, schemas
from .cache import invalidate
from .database import get_db
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from .deps import get_current_user

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


def _generate_invite_code(db: Session) -> str:
    """8-char unambiguous join code, retried until unique."""
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no I/L/O/0/1 (look-alikes)
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        if (
            not db.query(models.Business)
            .filter(models.Business.invite_code == code)
            .first()
        ):
            return code


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

    # Join-by-code: teammates register into an EXISTING business so roles are
    # meaningful. Creating a business is reserved for the owner path.
    if payload.join_mode == "join":
        code = (payload.invite_code or "").strip().upper()
        if not code:
            raise HTTPException(
                status_code=400,
                detail="Invite code is required to join a business.",
            )
        if payload.role == models.RoleEnum.admin:
            raise HTTPException(
                status_code=400,
                detail="Admin accounts can only be created by invite from an existing admin.",
            )
        if payload.role == models.RoleEnum.business_owner:
            raise HTTPException(
                status_code=400,
                detail="Business Owner accounts are created by starting a new business.",
            )
        business = (
            db.query(models.Business)
            .filter(models.Business.invite_code == code)
            .first()
        )
        if not business:
            raise HTTPException(
                status_code=400,
                detail="Invalid invite code. Ask your business owner for the correct code.",
            )
    else:
        # Multi-tenant registration: each "create" signup starts its own
        # business, and the person who registers becomes that business's owner.
        payload.role = models.RoleEnum.business_owner
        business = models.Business(
            company_name=payload.company_name,
            invite_code=_generate_invite_code(db),
        )
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

    db.refresh(user)
    return user


def _login_suspicion(db, user, device, location):
    """Return (is_suspicious, reason) for a login based on prior history.

    A login is flagged when the device or location has never been seen for
    this user before. Fresh accounts (<3 prior logins) are never flagged so
    first-time setup isn't noisy. Local/Unknown locations are treated as
    neutral (dev machines can't be geolocated).
    """
    from sqlalchemy import func as sa_func

    login_filter = (
        models.AuditLog.user_id == user.id,
        models.AuditLog.action_type == "login",
    )
    login_count = db.query(sa_func.count(models.AuditLog.id)).filter(*login_filter).scalar()
    if not login_count or login_count < 3:
        return False, None

    # "Known" = every device/location this user has ever logged in from
    # (distinct sets — no arbitrary recency window that testing noise can
    # flush a real device out of).
    known_devices = {
        d for (d,) in db.query(models.AuditLog.device).filter(*login_filter).distinct() if d
    }
    known_locations = {
        loc for (loc,) in db.query(models.AuditLog.location).filter(*login_filter).distinct() if loc
    }

    neutral_locations = {"Local", "Unknown"}
    device_known = device in known_devices or not device or device == "Unknown device"
    location_known = location in known_locations or location in neutral_locations

    if device_known and location_known:
        return False, None

    reasons = []
    if not device_known:
        reasons.append("new device")
    if not location_known:
        reasons.append("new location")
    return True, " and ".join(reasons)


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"login:{ip}", max_attempts=10, window=300)
    # Per-ACCOUNT lockout driven by failures only (never successes). The
    # pre-verify peek blocks further tries once an account has accumulated
    # 10 failures; the counter itself is filled in the failure branch below.
    _peek_rate_limit(f"login:acct:{payload.email.lower()}", max_attempts=10, window=300)

    user = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )

    if not user or not verify_password(payload.password, user.hashed_password):
        # Record the failure against this mailbox so the pre-verify peek can
        # lock the account after repeated misses, even across rotating IPs.
        now = time.time()
        acct_key = f"login:acct:{payload.email.lower()}"
        _rate_store[acct_key] = [t for t in _rate_store[acct_key] if now - t < 300]
        _rate_store[acct_key].append(now)
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

    # Log the login action to audit trail with device + location context,
    # flagging logins from devices/locations the user has never used before.
    try:
        from sqlalchemy import desc as sa_desc
        from .audit import log_action
        from ..core.client_info import parse_device, geolocate

        ua = request.headers.get("user-agent", "") if request else ""
        device = parse_device(ua)
        location, lat, lng = geolocate(ip)
        is_suspicious, suspicion_reason = _login_suspicion(db, user, device, location)
        log_action(
            db=db,
            action="Logged in",
            action_type="login",
            resource="Auth",
            user_id=user.id,
            user_name=user.full_name,
            business_id=user.business_id,
            ip_address=ip,
            user_agent=ua,
            device=device,
            location=location,
            latitude=lat,
            longitude=lng,
            is_suspicious=is_suspicious,
            suspicion_reason=suspicion_reason,
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
    # Cached instances are detached snapshots; mutate a fresh session-bound
    # row so db.commit() actually persists.
    from ..deps import _fresh_user
    current_user = _fresh_user(db, current_user)
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
    from ..deps import _fresh_user
    current_user = _fresh_user(db, current_user)
    invalidate(f"user:{current_user.id}")
    # A leaked session must not freely rotate the credential: prove knowledge
    # of the current password at a sane rate before accepting a new one.
    _check_rate_limit(f"chpass:{current_user.id}", max_attempts=5, window=300)
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
    request: Request,
    db: Session = Depends(get_db),
):
    # Rate-limit OTP issuance per IP and per mailbox: each send emails a real
    # code, so an unlimited endpoint is both a mail-bomb and a code-flood vector.
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"otp-send:{ip}", max_attempts=5, window=600)
    _check_rate_limit(f"otp-send:acct:{payload.email.lower()}", max_attempts=3, window=600)

    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not user:
        # Identical response and timing for unknown emails so the endpoint
        # cannot be used to enumerate registered addresses.
        random.randint(100000, 999999)  # burn comparable RNG work
        return {"message": "If an account with that email exists, an OTP code has been sent."}

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))

    # Save OTP & set 10-minute expiry
    user.reset_otp = otp
    user.reset_otp_expiry = dt.datetime.utcnow() + dt.timedelta(minutes=10)
    db.commit()

    # Send Real Email via SMTP
    try:
        send_email_otp(payload.email, otp)
    except Exception as e:
        # Log the detail server-side; the client gets a generic 502 so SMTP
        # errors never leak the mailer config back to the requester.
        import logging
        logging.warning(f"OTP email delivery failed for {payload.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send OTP email. Please try again later."
        )

    return {"message": f"OTP code sent to {payload.email}."}


@router.post("/reset-password-otp")
def reset_password_otp(
    payload: ResetPasswordOTPRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # A 6-digit code has 1e6 possibilities, so verification MUST be rate
    # limited (10 tries per mailbox per 10 min) or it is brute-forceable.
    _check_rate_limit(f"otp-reset:acct:{payload.email.lower()}", max_attempts=10, window=600)

    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if (
        not user
        or not user.reset_otp
        or user.reset_otp_expiry is None
        or user.reset_otp_expiry < dt.datetime.utcnow()
        or not hmac.compare_digest(user.reset_otp, payload.otp or "")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code.",
        )

    # Enforce a minimum password length on the reset path (matches the
    # registration policy) before persisting anything.
    if len(payload.new_password or "") < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )

    # Update password and clear reset OTP fields
    user.hashed_password = hash_password(payload.new_password)
    user.reset_otp = None
    user.reset_otp_expiry = None
    db.commit()

    return {"message": "Password reset successfully."}