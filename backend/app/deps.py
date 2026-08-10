from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .core.security import decode_access_token
from .cache import get_or_set
from . import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# The user lookup runs on EVERY authenticated request; on a remote database
# (Neon) that single query costs ~0.6s. Cache it — mutations
# (profile/password/avatar) invalidate the entry, so staleness is bounded and
# only affects the user's own row.
USER_CACHE_TTL = 60


def _load_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = get_or_set(
        f"user:{user_id}", USER_CACHE_TTL, lambda: _load_user(db, int(user_id))
    )
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*allowed_roles: str):
    """Dependency factory enforcing Role-Based Access Control (RBAC)."""

    def dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not permitted to perform this action.",
            )
        return current_user

    return dependency


ALL_ROLES = ["business_owner", "store_manager", "sales_executive", "admin"]
