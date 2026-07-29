from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.deps import get_current_user, require_roles
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])


class RoleUpdateRequest(BaseModel):
    role: models.RoleEnum


@router.get("", response_model=List[schemas.UserOut])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(models.RoleEnum.admin.value)),
):
    """Admin-only endpoint to list all users."""
    users = db.query(models.User).all()
    return users


@router.put("/{user_id}/role", response_model=schemas.UserOut)
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(models.RoleEnum.admin.value)),
):
    """Admin-only endpoint to update a user's role."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from changing their own role, to avoid locking themselves out
    if user.id == current_user.id and payload.role != models.RoleEnum.admin:
        raise HTTPException(
            status_code=400,
            detail="Cannot change your own role to non-admin. Ask another admin to do this.",
        )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user
