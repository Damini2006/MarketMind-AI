import os
import uuid
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
            except OSError:
                pass

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
            except OSError:
                pass
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


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
    return user


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
