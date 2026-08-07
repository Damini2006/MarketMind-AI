from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .core.security import decode_access_token
from . import models

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    token = credentials.credentials
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
    user = db.query(models.User).options(joinedload(models.User.role), joinedload(models.User.business)).filter(models.User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def require_roles(*allowed_roles: str):
    """Dependency factory enforcing Role-Based Access Control (RBAC)."""

    def dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role.role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.role_name}' is not permitted to perform this action.",
            )
            
        return current_user

    return dependency

ALL_ROLES = ["business_owner", "store_manager", "sales_executive", "admin"]
