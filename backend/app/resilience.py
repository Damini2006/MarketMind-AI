"""Resilience helpers for the remote (Neon) PostgreSQL connection.

The backend runs in a container against Neon serverless Postgres in
``us-east-2``. Two failure modes show up repeatedly in the logs, and both are
TRANSIENT — the exact same call almost always succeeds a moment later:

  * **DNS.** The container resolver intermittently fails to resolve the Neon
    host: ``could not translate host name ... to address: Name or service not
    known`` / ``No address associated with hostname``. Docker Desktop's
    embedded resolver (127.0.0.11 -> the host resolver) is the weak link.
  * **Connection loss.** ``SSL SYSCALL error: EOF detected`` / ``server closed
    the connection unexpectedly`` — Neon suspends idle compute, or the pooler
    recycles a backend and drops the socket. ``pool_pre_ping`` catches this at
    checkout, but a connection can also die mid-operation.

Retrying a *transient* failure with exponential backoff + jitter turns these
from user-visible errors into a brief pause. Equally important, the loops that
do this run on 10–120 second timers, so logging every failure floods the
container log; :func:`log_throttled` collapses repeats of the same failure
into a single line plus a suppressed-count.

Nothing here is Neon-specific: the markers are plain libpq/psycopg2 strings.
"""
from __future__ import annotations

import functools
import logging
import random
import threading
import time
from typing import Callable, Optional, Tuple, TypeVar

from sqlalchemy.exc import DisconnectionError, SQLAlchemyError

log = logging.getLogger(__name__)

T = TypeVar("T")

# Lower-cased substrings that mark a transient failure. Deliberately specific:
# a genuine bug (bad SQL, missing column, constraint violation) must NOT match,
# or we would retry forever instead of surfacing it.
TRANSIENT_DB_MARKERS: Tuple[str, ...] = (
    # ── DNS / resolver ──
    "could not translate host name",
    "name or service not known",
    "no address associated with hostname",
    "temporary failure in name resolution",
    "nodename nor servname provided",
    # ── dropped / unavailable connection ──
    "ssl syscall error",
    "eof detected",
    "server closed the connection unexpectedly",
    "connection reset by peer",
    "connection refused",
    "could not connect to server",
    "terminating connection due to administrator command",
    "the database system is starting up",
    "connection already closed",
    "connection has been closed",
    "server conn crashed",
    "server process was terminated",
)

# Marker matching is only trusted for errors that carry connectivity meaning.
# A stray "connection refused" from, say, an SMTP failure should not be retried
# as if it were the database. socket.gaierror/ConnectionResetError are OSError
# subclasses, so OSError covers every resolver/socket path.
_DB_ERROR_TYPES: Tuple[type, ...] = (SQLAlchemyError, OSError)

_MAX_CHAIN = 12

# Indirection so tests can neutralise the delay without patching time.sleep
# globally (which would also slow unrelated retry logic).
_SLEEP: Callable[[float], None] = time.sleep


def _walk_chain(exc: BaseException):
    """Yield ``exc`` and its cause/context/``.orig`` chain, without looping.

    SQLAlchemy wraps the driver error in ``DBAPIError`` and hangs the original
    psycopg2 exception off ``.orig``; psycopg2 in turn chains its own
    ``__context__``. The relevant text can live in any of them.
    """
    seen: set[int] = set()
    stack = [exc]
    while stack and len(seen) < _MAX_CHAIN:
        err = stack.pop()
        if err is None or id(err) in seen:
            continue
        seen.add(id(err))
        yield err
        for attr in ("__cause__", "__context__", "orig"):
            nxt = getattr(err, attr, None)
            if isinstance(nxt, BaseException):
                stack.append(nxt)


def is_transient_db_error(exc: BaseException) -> bool:
    """True when ``exc`` looks like a temporary connectivity failure.

    Retrying is worthwhile only for these. Note that most SQLAlchemy
    ``DBAPIError`` subclasses (integrity, programming, data errors) are NOT
    transient, which is why classification is driven by the message content
    rather than by the exception class alone.
    """
    import socket  # local: keeps the module import cheap

    for err in _walk_chain(exc):
        if isinstance(err, DisconnectionError):
            return True
        if not isinstance(err, _DB_ERROR_TYPES + (socket.gaierror,)):
            continue
        text = str(err).lower()
        if any(marker in text for marker in TRANSIENT_DB_MARKERS):
            return True
    return False


def backoff_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    """Exponential backoff with full-width jitter for ``attempt`` (1-based).

    Jitter matters here: every background loop retries on the same timer, so
    without it they would all wake and stampede the database together.
    """
    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
    if delay <= 0:
        return 0.0
    return delay + random.uniform(0, delay * 0.25)


def call_with_retry(
    fn: Callable[[], T],
    *,
    attempts: int = 6,
    base_delay: float = 0.75,
    max_delay: float = 30.0,
    label: str = "db",
    logger: Optional[logging.Logger] = None,
    on_retry: Optional[Callable[[int, BaseException, float], None]] = None,
) -> T:
    """Call ``fn`` and retry transient database failures with backoff.

    The whole callable is retried, so ``fn`` must be safe to run more than
    once: give it its OWN session (open inside ``fn``) rather than passing in a
    session that a failed attempt may have left in an aborted transaction.

    Non-transient exceptions propagate immediately — we never retry a real bug.
    On exhaustion the last exception propagates.
    """
    logger = logger or log
    attempts = max(1, attempts)
    last_exc: Optional[BaseException] = None

    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - classified immediately below
            last_exc = exc
            transient = is_transient_db_error(exc)
            if not transient or attempt == attempts:
                raise
            delay = backoff_delay(attempt, base_delay, max_delay)
            logger.info(
                "%s: transient failure on attempt %d/%d (%s: %s); retrying in %.1fs",
                label,
                attempt,
                attempts,
                type(exc).__name__,
                exc,
                delay,
            )
            if on_retry is not None:
                on_retry(attempt, exc, delay)
            _SLEEP(delay)

    # Unreachable: the loop either returns or raises.
    raise last_exc  # type: ignore[misc]


def retry_db(
    *,
    attempts: int = 6,
    base_delay: float = 0.75,
    max_delay: float = 30.0,
    label: Optional[str] = None,
):
    """Decorator form of :func:`call_with_retry`."""

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            return call_with_retry(
                lambda: fn(*args, **kwargs),
                attempts=attempts,
                base_delay=base_delay,
                max_delay=max_delay,
                label=label or fn.__name__,
            )

        return wrapper

    return decorator


# ── throttled logging ────────────────────────────────────────────────────
_throttle_lock = threading.Lock()
_throttle_state: dict = {}  # key -> (last_emit_monotonic, suppressed_count)


def log_throttled(
    logger: logging.Logger,
    key: str,
    message: str,
    *,
    level: int = logging.WARNING,
    min_interval: float = 60.0,
    exc_info=None,
) -> bool:
    """Log ``message`` at most once per ``min_interval`` seconds per ``key``.

    Returns True when the message was actually emitted. Suppressed repeats are
    counted and reported on the next emit, so nothing is silently lost — the
    log just stops repeating the same line every ten seconds.
    """
    now = time.monotonic()
    emit = False
    suppressed = 0
    with _throttle_lock:
        last, suppressed = _throttle_state.get(key, (0.0, 0))
        if now - last >= min_interval:
            _throttle_state[key] = (now, 0)
            emit = True
        else:
            _throttle_state[key] = (last, suppressed + 1)

    if emit:
        if suppressed:
            message = f"{message} ({suppressed} similar suppressed)"
        logger.log(level, message, exc_info=exc_info)
    return emit


def reset_throttle() -> None:
    """Clear throttle state — used by tests so intervals don't leak across them."""
    with _throttle_lock:
        _throttle_state.clear()
