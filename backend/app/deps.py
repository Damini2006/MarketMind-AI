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


def _detached_user(db: Session, user_id: int):
    """Load the user fully populated and detached from the session.

    The instance is cached process-wide, so it must survive this request's
    session closing: every column is loaded eagerly and the instance is then
    detached, so attribute access can never trigger a lazy refresh (the
    DetachedInstanceError seen when a cached user outlived its session).
    Cached instances are READ-ONLY snapshots; endpoints that mutate the user
    re-fetch a session-bound row via _fresh_user below.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        return None
    db.expunge(user)  # detached: safe to cache and share across sessions
    return user


def _fresh_user(db: Session, user: models.User) -> models.User:
    """Re-fetch the user as a session-bound row for mutating endpoints.

    A detached cached instance carries no session: db.commit() on it is a
    silent no-op, so profile/password/avatar updates would appear to succeed
    without persisting. Re-querying yields a live instance that commits.
    """
    return db.query(models.User).filter(models.User.id == user.id).first()


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
        f"user:{user_id}", USER_CACHE_TTL, lambda: _detached_user(db, int(user_id))
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
