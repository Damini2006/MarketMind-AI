import logging
import os
import secrets
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import models, schemas
from ..cache import invalidate
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..core.security import hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])

# Uploaded avatars live in backend/uploads/avatars and are served from /uploads
# (users.py is backend/app/routers/ — go up three levels to reach backend/)
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
    "avatars",
)
ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB


class InviteRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role_name: str


@router.post("/avatar", response_model=schemas.UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload a profile photo. Stored under /uploads/avatars, URL on the user."""
    invalidate(f"user:{current_user.id}")
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, WEBP or GIF images are allowed.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Remove the previous avatar file (if any) to avoid orphaned files
    if current_user.avatar_url:
        old_path = os.path.join(UPLOAD_DIR, os.path.basename(current_user.avatar_url))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError as exc:
                import logging
                logging.warning(f"Failed to delete old avatar file: {exc}")

    ext = ALLOWED_AVATAR_TYPES[file.content_type]
    filename = f"u{current_user.id}_{uuid.uuid4().hex[:10]}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(data)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/avatar", response_model=schemas.UserOut)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove the profile photo and fall back to initials."""
    invalidate(f"user:{current_user.id}")
    if current_user.avatar_url:
        old_path = os.path.join(UPLOAD_DIR, os.path.basename(current_user.avatar_url))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError as exc:
                import logging
                logging.warning(f"Failed to delete old avatar file: {exc}")
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/invite-code")
def get_invite_code(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    """The join code teammates enter at sign-up to join this business."""
    business = (
        db.query(models.Business)
        .filter(models.Business.id == current_user.business_id)
        .first()
    )
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Legacy businesses created before join-by-code: generate lazily.
    if not business.invite_code:
        business.invite_code = _generate_invite_code(db)
        db.commit()

    return {"invite_code": business.invite_code, "company_name": business.company_name}


@router.post("/invite-code/regenerate")
def regenerate_invite_code(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner",)),
):
    """Invalidate the old code and issue a fresh one (owners only)."""
    business = (
        db.query(models.Business)
        .filter(models.Business.id == current_user.business_id)
        .first()
    )
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    business.invite_code = _generate_invite_code(db)
    db.commit()
    return {"invite_code": business.invite_code}


def _generate_invite_code(db: Session) -> str:
    """8-char unambiguous join code, retried until unique."""
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        if (
            not db.query(models.Business)
            .filter(models.Business.invite_code == code)
            .first()
        ):
            return code


@router.get("/business")
def get_business_info(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Company card info for the current user's tenant."""
    business = (
        db.query(models.Business)
        .filter(models.Business.id == current_user.business_id)
        .first()
    )
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    member_count = (
        db.query(models.User)
        .filter(models.User.business_id == business.id)
        .count()
    )
    return {
        "company_name": business.company_name,
        "member_count": member_count,
        "created_at": business.created_at,
    }


@router.get("/", response_model=List[schemas.UserOut])
def list_team(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    return (
        db.query(models.User)
        .filter(models.User.business_id == current_user.business_id)
        .order_by(models.User.id)
        .all()
    )


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def invite_user(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        role = models.RoleEnum(payload.role_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role_name}")

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=role,
        business_id=current_user.business_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Email the credentials so the invite actually reaches the member.
    # Best-effort: a broken SMTP config must not roll back the invite.
    try:
        _send_invite_email(
            to_email=payload.email,
            full_name=payload.full_name,
            role_name=role.value,
            password=payload.password,
            inviter_name=current_user.full_name,
            company_name=_business_name(db, current_user.business_id),
        )
    except Exception as exc:
        logging.warning(f"Invite email not sent to {payload.email}: {exc}")

    return user


def _business_name(db: Session, business_id: int) -> str:
    business = (
        db.query(models.Business)
        .filter(models.Business.id == business_id)
        .first()
    )
    return business.company_name if business else "MarketMind AI"


def _send_invite_email(
    to_email: str,
    full_name: str,
    role_name: str,
    password: str,
    inviter_name: str,
    company_name: str,
) -> None:
    """Send team-invite credentials via SMTP (same settings as the OTP mailer)."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    if not sender_email or not sender_password:
        raise ValueError("SENDER_EMAIL/SENDER_PASSWORD are not configured")

    # Frontend base URL differs between dev (Vite :5173) and Docker (:3000)
    app_url = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")

    role_label = role_name.replace("_", " ").title()
    message = MIMEMultipart("alternative")
    message["Subject"] = f"You've been added to {company_name} on MarketMind AI"
    message["From"] = f"MarketMind AI <{sender_email}>"
    message["To"] = to_email

    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 520px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #2e2b8f; margin-top: 0;">Welcome to {company_name}!</h2>
          <p>Hi {full_name},</p>
          <p><strong>{inviter_name}</strong> has added you to <strong>{company_name}</strong> on MarketMind AI as a <strong>{role_label}</strong>.</p>
          <p>Sign in with these credentials:</p>
          <div style="background-color: #f4f4f9; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 15px;">{password}</span></p>
          </div>
          <p>
            <a href="{app_url}/login" style="display: inline-block; background: #2e2b8f; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: bold;">Sign in to MarketMind AI</a>
          </p>
          <p style="font-size: 12px; color: #777;">For security, please change your password after your first sign-in (Settings → Profile).</p>
        </div>
      </body>
    </html>
    """

    message.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(smtp_server, smtp_port, timeout=15) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, message.as_string())


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
            models.User.business_id == current_user.business_id,
        )
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return None


@router.get("/tour-status")
def get_tour_status(current_user=Depends(get_current_user)):
    return {"tour_completed": getattr(current_user, "tour_completed", False)}


@router.put("/tour-status")
def update_tour_status(body: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.tour_completed = body.get("tour_completed", True)
    db.commit()
    return {"tour_completed": current_user.tour_completed}
