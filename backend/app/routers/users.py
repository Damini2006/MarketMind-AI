from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..core.security import hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])

class InviteRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role_name: str

@router.get("/", response_model=List[schemas.UserOut])
def list_team(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.User).options(joinedload(models.User.role), joinedload(models.User.business)).filter(models.User.business_id == current_user.business_id).all()

@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def invite_user(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    role = db.query(models.Role).filter(models.Role.role_name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role_name}")
        
    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
        business_id=current_user.business_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return db.query(models.User).options(joinedload(models.User.role), joinedload(models.User.business)).filter(models.User.id == user.id).first()

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("business_owner", "admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
        
    user = db.query(models.User).filter(models.User.id == user_id, models.User.business_id == current_user.business_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return None
