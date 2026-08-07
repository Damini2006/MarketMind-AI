import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from ..deps import get_current_user

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

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
            detail="Email already registered",
        )
        
    # Public registration always creates a new business and owner
    role = db.query(models.Role).filter(models.Role.role_name == "business_owner").first()
    if not role:
        raise HTTPException(
            status_code=500,
            detail="Role 'business_owner' not found in database.",
        )

    business = models.Business(company_name=payload.company_name)
    db.add(business)
    db.flush()

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
        business_id=business.id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Eager load role and business for response
    user = db.query(models.User).options(joinedload(models.User.role), joinedload(models.User.business)).filter(models.User.id == user.id).first()

    return user

@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .options(joinedload(models.User.role), joinedload(models.User.business))
        .filter(models.User.email == payload.email)
        .first()
    )

    if not user or not verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )
        
    # Update last_login
    user.last_login = dt.datetime.utcnow()
    db.commit()

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.role_name,
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