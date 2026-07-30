import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import verify_password, create_access_token, hash_password
from app.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _generate_username(db: Session, name: str, email: str) -> str:
    """Derive a unique username from the email's local part (frontend only
    collects name/email/password, not a separate username)."""
    base = re.sub(r"[^a-zA-Z0-9]", "", email.split("@")[0].lower()) or "user"
    candidate = base
    suffix = 1
    while db.query(models.User).filter(models.User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


@router.post("/register", response_model=schemas.AuthUser, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    username = _generate_username(db, payload.name, payload.email)
    user = models.User(
        username=username,
        email=payload.email,
        full_name=payload.name,
        hashed_password=hash_password(payload.password),
        role=payload.role,  # default role; an admin can promote via /api/users
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.AuthUser(id=user.id, name=user.full_name, email=user.email, role=user.role)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if user.role != payload.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect role selected"
        )

    token = create_access_token({"sub": user.username, "role": user.role.value})
    return schemas.AuthResponse(
        token=token,
        user=schemas.AuthUser(id=user.id, name=user.full_name, email=user.email, role=user.role),
    )


@router.get("/me", response_model=schemas.AuthUser)
def me(current_user: models.User = Depends(get_current_user)):
    return schemas.AuthUser(
        id=current_user.id, name=current_user.full_name, email=current_user.email, role=current_user.role
    )
