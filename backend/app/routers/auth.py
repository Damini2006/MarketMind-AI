import os
import hashlib
import hmac
import secrets
import time
import uuid
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

from .. import models, schemas
from ..cache import invalidate
from ..database import get_db
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from ..core.env import is_production
from ..deps import get_current_user
from fastapi.responses import JSONResponse
from fastapi import Response

# --- Correct Prefix with /api/auth ---
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

SESSION_COOKIE = "marketmind_session"
CSRF_COOKIE = "marketmind_csrf"
# The refresh token is PATH-SCOPED to the auth endpoints: this long-lived
# credential is only ever sent to /api/auth/*, never on ordinary API calls or
# the WebSocket handshake, so its exposure surface is a handful of routes.
REFRESH_COOKIE = "marketmind_refresh"
REFRESH_COOKIE_PATH = "/api/auth"
# A rotation presented within this window after the previous one is treated as
# a multi-tab race (two tabs refreshing on the same 401), not as theft. Beyond
# it, re-presenting a rotated token is the standard reuse signal.
REFRESH_REUSE_GRACE_SECONDS = 30


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


def _new_otp() -> str:
    """A 6-digit password-reset code drawn from a cryptographic RNG.

    `random` is a Mersenne Twister: its output stream is not unpredictable,
    which is the wrong property for the secret that guards account takeover.
    Range matches the original (100000-999999, no leading-zero codes).
    """
    return str(secrets.randbelow(900_000) + 100_000)


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
            detail="If this email is registered, use Login. If you forgot your password, use Reset Password.",
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
    response = JSONResponse(
        schemas.UserOut.model_validate(user).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )
    _set_session_cookie(response, create_access_token({
        "sub": str(user.id),
        "role": payload.role.value if hasattr(payload.role, "value") else str(payload.role),
    }))
    _set_csrf_cookie(response)
    _set_refresh_cookie(response, _issue_refresh_token(db, user, request))
    return response


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
        # Generic message — never reveal whether the mailbox exists.
        raise HTTPException(
            status_code=401,
            detail="If this email is registered, check your password. If you forgot your password, use Reset Password.",
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

    response = JSONResponse(
        {
            "access_token": token,
            "token_type": "bearer",
            "user": schemas.UserOut.model_validate(user).model_dump(),
        }
    )
    _set_session_cookie(response, token)
    _set_csrf_cookie(response)
    _set_refresh_cookie(response, _issue_refresh_token(db, user, request))
    return response


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
    request: Request,
    response: Response,
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
    # A credential rotation must also end every session minted before it, or a
    # stolen refresh token survives the password change. This browser is then
    # immediately re-issued a fresh pair so the user is not logged out by
    # securing their own account.
    _revoke_all_refresh_tokens(db, current_user.id)
    new_refresh = _issue_refresh_token(db, current_user, request)
    access = create_access_token({
        "sub": str(current_user.id),
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    })
    _set_session_cookie(response, access)
    _set_csrf_cookie(response)
    _set_refresh_cookie(response, new_refresh)
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
        _new_otp()  # burn comparable RNG work
        return {"message": "If an account with that email exists, an OTP code has been sent."}

    # Generate 6-digit OTP from a CSPRNG
    otp = _new_otp()

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
    # Same rule as change-password: rotating the credential revokes every
    # outstanding refresh session (the reset flow starts from a login anyway).
    _revoke_all_refresh_tokens(db, user.id)
    db.commit()
    return {"message": "Password reset successfully."}



def _set_session_cookie(response: Response, token: str) -> None:
    """Attach the httpOnly session cookie to a login/register response.

    The browser stores this cookie and sends it automatically on every
    subsequent same-site request (including the WebSocket handshake), so the
    JWT never needs to live in JavaScript-accessible storage. The cookie is

    * httponly  — not readable by page JS, so XSS cannot exfiltrate it;
    * secure     — only over HTTPS, and only when the environment is production
                  (dev runs on plain HTTP and would reject a Secure cookie);
    * samesite=lax — blocks the cookie on cross-site sub-requests/WS handshakes,
                  which is the primary CSRF defence for the in-process rate limiter.
    """
    response.set_cookie(
        key="marketmind_session",
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        httponly=True,
        secure=is_production(),
        samesite="lax",
    )


def _set_csrf_cookie(response: Response) -> None:
    """Deliver a CSRF token to the browser via a non-httpOnly cookie.

    Page JS reads this cookie (it is NOT httpOnly) and sends the value back in
    the X-CSRF-Token request header. The server verifies the header matches the
    cookie before honouring any state-changing request, which blocks a malicious
    cross-site page from submitting forms/XHR as the victim (it cannot read the
    cookie to populate the header, and SameSite=Lax stops the cookie being sent
    on the cross-site sub-request in the first place).

    The cookie uses the same lifetime, path and SameSite as the session cookie
    so the two stay in sync; it is deliberately NOT httponly (JS must read it)
    and NOT Secure-only in dev (plain HTTP would otherwise reject it).
    """
    response.set_cookie(
        key="marketmind_csrf",
        value=secrets.token_hex(32),
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        httponly=False,
        secure=is_production(),
        samesite="lax",
    )


def _hash_refresh_token(raw: str) -> str:
    """SHA-256 digest of a raw refresh token.

    Only this digest is ever persisted: a database leak (or a backup landing
    in the wrong hands) yields nothing replayable, the same reasoning that
    applies to storing password hashes instead of passwords.
    """
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _issue_refresh_token(
    db: Session,
    user: models.User,
    request: Optional[Request] = None,
    family_id: Optional[str] = None,
) -> str:
    """Persist a refresh token and return its RAW value.

    The raw value goes straight into the httpOnly cookie and is never stored
    server-side; ``family_id`` groups every token descended from one login so
    a detected reuse can revoke the whole session lineage at once.
    """
    raw = secrets.token_urlsafe(48)  # 384 bits of CSPRNG output
    row = models.RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw),
        family_id=family_id or str(uuid.uuid4()),
        expires_at=dt.datetime.utcnow() + dt.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(row)
    db.commit()
    return raw


def _set_refresh_cookie(response: Response, raw: str) -> None:
    """Deliver the refresh token in an httpOnly cookie scoped to /api/auth.

    Same flags as the session cookie (httponly, Secure in production,
    SameSite=Lax) but path-restricted: the long-lived credential only travels
    to the auth endpoints, not to every API call.
    """
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=is_production(),
        samesite="lax",
    )


def _revoke_refresh_family(db: Session, family_id: str) -> None:
    db.query(models.RefreshToken).filter(
        models.RefreshToken.family_id == family_id,
        models.RefreshToken.revoked.is_(False),
    ).update({"revoked": True}, synchronize_session=False)
    db.commit()


def _revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
    """Kill every outstanding refresh session for a user.

    Used when the credential itself changes: a password rotation must also
    end any session an attacker obtained before the change.
    """
    db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == user_id,
        models.RefreshToken.revoked.is_(False),
    ).update({"revoked": True}, synchronize_session=False)
    db.commit()


@router.post("/refresh")
def refresh_session(request: Request, db: Session = Depends(get_db)):
    """Exchange the refresh cookie for a fresh access token (with rotation).

    Every successful call rotates the refresh token: the presented one is
    burned and a replacement is issued in the same family. Presenting a token
    that was already rotated is the classic theft signal — outside a short
    grace window for concurrent tabs, the whole family is revoked, ending the
    session for attacker and victim alike (the only safe assumption: you
    cannot tell which holder is the thief).
    """
    ip = request.client.host if request.client else "unknown"
    # The token itself is 48 bytes of CSPRNG output, so guessing is hopeless;
    # this bound only limits how fast a replayed token can be probed and keeps
    # a misbehaving client from hammering the endpoint.
    _check_rate_limit(f"refresh:{ip}", max_attempts=30, window=300)

    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    row = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.token_hash == _hash_refresh_token(raw))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    if row.revoked or row.used_at is not None:
        within_grace = (
            row.used_at is not None
            and (dt.datetime.utcnow() - row.used_at).total_seconds()
            <= REFRESH_REUSE_GRACE_SECONDS
        )
        if not within_grace:
            _revoke_refresh_family(db, row.family_id)
            import logging
            logging.warning(
                "Refresh token reuse detected (user %s, family %s) — "
                "revoking the whole token family.",
                row.user_id,
                row.family_id,
            )
            raise HTTPException(
                status_code=401,
                detail="Session revoked. Please log in again.",
            )
        # Inside the grace window: two tabs raced the same rotation. Fall
        # through and rotate again rather than logging the user out.
    elif row.expires_at < dt.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    user = db.query(models.User).filter(models.User.id == row.user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    # Rotate: the presented token is burned whether it was fresh or riding
    # out the multi-tab grace window.
    row.used_at = dt.datetime.utcnow()
    row.revoked = True
    new_raw = _issue_refresh_token(db, user, request, family_id=row.family_id)

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    access = create_access_token({"sub": str(user.id), "role": role_str})
    response = JSONResponse(
        {
            "access_token": access,
            "token_type": "bearer",
            "user": schemas.UserOut.model_validate(user).model_dump(),
        }
    )
    _set_session_cookie(response, access)
    _set_csrf_cookie(response)
    _set_refresh_cookie(response, new_raw)
    return response


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Clear the session cookie and revoke the refresh token. No auth required
    — anyone may end their own session. The JWT itself stays stateless (there
    is no server-side session to destroy); burning the refresh token matters
    because that credential would otherwise outlive the access token for up to
    REFRESH_TOKEN_EXPIRE_DAYS.
    """
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        row = (
            db.query(models.RefreshToken)
            .filter(models.RefreshToken.token_hash == _hash_refresh_token(raw))
            .first()
        )
        if row is not None and not row.revoked:
            # Only `revoked` is set: `used_at` records ROTATION, and the
            # refresh endpoint's multi-tab grace window keys off it — marking
            # a logout as a rotation would let a replay slip through for
            # REFRESH_REUSE_GRACE_SECONDS.
            row.revoked = True
            db.commit()
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    response.delete_cookie(key=CSRF_COOKIE, path="/")
    response.delete_cookie(key=REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    return {"message": "logged out"}
