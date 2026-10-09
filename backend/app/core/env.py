"""Environment classification for security-sensitive startup behaviour.

One switch, read from the environment, decides whether this process should treat
itself as production:

    ENVIRONMENT=production   (alias: APP_ENV=production / prod)

Anything else — unset, "development", "test", "ci", "staging" — is treated as
non-production, which keeps local development and the CI smoke stack working
exactly as before.

Why this exists: several behaviours that are convenient while developing are
unsafe in a real deployment (a random JWT signing key that invalidates every
session on restart, demo accounts whose passwords are published in the README).
Rather than forcing every operator to remember a flag, the *unsafe* default is
scoped to non-production and production gets the strict behaviour. See
`core/security.py` and `seed_data.py`.
"""
import os

_PRODUCTION_ALIASES = {"production", "prod"}


def environment() -> str:
    """Return the lower-cased environment name; "development" when unset."""
    raw = os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development"
    return raw.strip().lower()


def is_production() -> bool:
    """True only for the explicit production aliases above.

    Deliberately conservative: an unrecognised value is NOT production, so a
    typo cannot silently turn the demo seeders back on in a real deployment
    *or* make a dev machine start failing its own startup checks.
    """
    return environment() in _PRODUCTION_ALIASES


DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:5174"


def parse_cors_origins(raw: str) -> tuple[list[str], bool]:
    """Split a comma-separated origin list, dropping any ``*`` entry.

    The backend sets ``allow_credentials=True``, which makes this list the
    security boundary: a wildcard would tell the browser it may send a
    logged-in user's Authorization header to *any* site that asks. So ``*`` is
    removed rather than honoured, and the caller is told it happened so it can
    complain loudly instead of failing open in silence.

    Returns ``(origins, wildcard_was_dropped)``.
    """
    origins = [origin.strip() for origin in (raw or "").split(",") if origin.strip()]
    wildcard = "*" in origins
    return [origin for origin in origins if origin != "*"], wildcard
