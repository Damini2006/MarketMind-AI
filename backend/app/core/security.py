import os
import sys
import secrets
import datetime as dt
from typing import Optional
from jose import jwt, JWTError
import bcrypt

# JWT secret MUST be set in .env — no hardcoded fallback for security.
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    # Auto-generate a random key for first run, warn loudly
    SECRET_KEY = secrets.token_hex(32)
    print("WARNING: JWT_SECRET_KEY not set in .env. Generated a random key.", file=sys.stderr)
    print("  Add JWT_SECRET_KEY to backend/.env for persistent sessions.", file=sys.stderr)
    print(f"  JWT_SECRET_KEY={SECRET_KEY}", file=sys.stderr)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = dt.datetime.utcnow() + dt.timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None