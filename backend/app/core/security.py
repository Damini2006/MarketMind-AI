import os
import sys
import secrets
import datetime as dt
from typing import Optional
from jose import jwt, JWTError
import bcrypt

from .env import is_production

# JWT signing key. In PRODUCTION it must be supplied by the environment — a
# missing or placeholder secret is a hard startup failure, because the key is
# the *entire* authentication boundary: anyone who knows it can mint a token
# for any user id, including an admin. Silently generating one would look fine
# in a log and be catastrophic in practice.
#
# Outside production the random fallback is kept: it is convenient for a first
# local run, and it cannot protect anything real because sessions reset on
# restart (the warning below says so).
_PLACEHOLDER_SECRETS = {
    "your-random-secret-min-32-chars",
    "changeme",
    "secret",
    "change-me",
    "test",
    "ci-smoke-test-only-signing-key-not-used-in-production",
}

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if is_production():
    _problem = None
    if not SECRET_KEY:
        _problem = "JWT_SECRET_KEY is not set"
    elif SECRET_KEY.strip() in _PLACEHOLDER_SECRETS:
        # Checked before the length test on purpose: the example placeholder in
        # .env.example is 31 characters, so the length rule would fire first and
        # report "too short" instead of the real problem (someone copied the
        # template and never replaced the value).
        _problem = "JWT_SECRET_KEY is still the example placeholder value"
    elif len(SECRET_KEY) < 32:
        _problem = f"JWT_SECRET_KEY is only {len(SECRET_KEY)} characters (need >= 32)"

    if _problem:
        sys.stderr.write(
            f"\n[config] ENVIRONMENT=production but {_problem}.\n"
            "[config] Generate one and set it on the host (never commit it):\n"
            "[config]   python -c \"import secrets; print(secrets.token_urlsafe(48))\"\n"
            "[config] Refusing to start: a weak or known signing key means any\n"
            "[config] caller can forge a token for any account, including admin.\n\n"
        )
        raise SystemExit(1)

if not SECRET_KEY:
    # Auto-generate a random key for first run. NEVER print the value:
    # logs are routinely shipped/aggregated, and a leaked signing key means
    # total authentication bypass (anyone can mint valid tokens).
    SECRET_KEY = secrets.token_hex(32)
    import logging
    logging.warning(
        "JWT_SECRET_KEY not set in .env — generated an EPHEMERAL random key. "
        "All sessions reset on restart. Add JWT_SECRET_KEY to backend/.env "
        "for persistent sessions."
    )
ALGORITHM = "HS256"
# 3 hours by default. The access token is deliberately short-lived because it
# is the credential a stolen XSS payload would replay; convenience beyond that
# comes from the refresh-token flow (/api/auth/refresh), not from a longer
#-lived access token. Read once at import: the value is fixed for the
# lifetime of a process.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 3))

# Refresh tokens live in their own httpOnly cookie scoped to /api/auth, are
# rotated on every use, and are stored server-side only as a SHA-256 hash —
# so a leaked database row cannot be replayed as a session.
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    now = dt.datetime.utcnow()
    # `iat` is set so a token's age is auditable; `exp` remains the only
    # enforced claim (decoding checks it, see decode_access_token). `jti`
    # makes every minted token unique — jose serialises timestamps to whole
    # seconds, so without it two tokens issued in the same second for the same
    # user would be byte-identical (a refresh would appear to return the very
    # token it just replaced).
    to_encode.update({
        "exp": now + dt.timedelta(minutes=expires_minutes),
        "iat": now,
        "jti": secrets.token_hex(16),
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None