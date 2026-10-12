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
import os
import random
import socket
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


# ── resolver hardening ───────────────────────────────────────────────────
#
# Why a retry around the database call is not enough for the DNS failure.
#
# The backend runs in a container whose resolver is Docker's embedded one
# (127.0.0.11, forwarding to whatever upstreams are configured). Intermittently,
# and more often under concurrent load, it answers EAI_AGAIN — "Temporary
# failure in name resolution" — which is the DNS half of the failure described
# at the top of this module.
#
# :func:`call_with_retry` cannot cover that on its own, because the lookup
# happens inside libpq, in C: libpq calls getaddrinfo itself, so replacing
# Python's socket.getaddrinfo changes nothing. Measured, not assumed — with
# socket.getaddrinfo patched to raise unconditionally, psycopg2 still connected.
# The only lever that works is to stop libpq resolving: hand it a numeric
# ``hostaddr``, which libpq uses verbatim for the socket while still sending
# ``host`` as the TLS SNI name Neon routes on. database.py does exactly that,
# and it resolves the address through :func:`resolve_host` below, so the lookup
# becomes cached, retried and shared on the Python side where we control it.
#
# The cache is deliberately short-lived: Neon's endpoint address can change
# (failover, maintenance), so a long TTL would pin a dead address. A stale entry
# is only ever used to ride out a resolver outage, and only for
# DNS_STALE_MAX seconds.


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


_RESOLVER_TTL = _env_float("DNS_CACHE_TTL", 60.0)
_RESOLVER_STALE_MAX = _env_float("DNS_STALE_MAX", 900.0)
_RESOLVER_ATTEMPTS = _env_int("DNS_RESOLVER_ATTEMPTS", 4)
_RESOLVER_BASE_DELAY = _env_float("DNS_RESOLVER_BASE_DELAY", 0.2)
_RESOLVER_MAX_DELAY = _env_float("DNS_RESOLVER_MAX_DELAY", 2.0)

# The code the container resolver raises when *it* is the thing failing.
# EAI_AGAIN is explicitly temporary. A misspelled host comes back as EAI_NONAME
# and must NOT be retried, and must NOT be papered over with a stale address —
# that would turn a real misconfiguration into a puzzling timeout.
_TRANSIENT_GAI_CODES = {getattr(socket, "EAI_AGAIN", -3)}

_resolver_guard = threading.Lock()
_resolver_host_locks: dict = {}
_resolver_cache: dict = {}  # host -> (expires_at, resolved_at, addrinfo)
_resolver_stats = {
    "hits": 0,
    "lookups": 0,
    "retries": 0,
    "stale_served": 0,
    "failures": 0,
}


def _bump(key: str, n: int = 1) -> None:
    with _resolver_guard:
        _resolver_stats[key] = _resolver_stats.get(key, 0) + n


def _host_lock(host: str) -> threading.Lock:
    with _resolver_guard:
        lock = _resolver_host_locks.get(host)
        if lock is None:
            lock = threading.Lock()
            _resolver_host_locks[host] = lock
        return lock


def _cache_get(host: str, *, allow_stale: bool = False):
    now = time.monotonic()
    with _resolver_guard:
        entry = _resolver_cache.get(host)
    if entry is None:
        return None
    expires_at, resolved_at, addrinfo = entry
    if expires_at > now:
        return addrinfo
    if allow_stale and (now - resolved_at) <= _RESOLVER_STALE_MAX:
        return addrinfo
    return None


def resolve_host(
    host: str,
    port=None,
    *,
    ttl: Optional[float] = None,
    attempts: Optional[int] = None,
    base_delay: Optional[float] = None,
):
    """Resolve ``host`` through a TTL cache, with retries and a stale fallback.

    Returns the ``socket.getaddrinfo`` result — a list of 5-tuples, so the
    caller can pick whatever address family it needs — or raises the last
    ``socket.gaierror`` when every attempt failed and no cached address was
    usable.

    Concurrent callers for the same host share one lookup (single-flight): a
    burst of connection attempts must not stampede the resolver that is already
    the unreliable component here.
    """
    if not host:
        raise ValueError("resolve_host() needs a host")

    ttl = _RESOLVER_TTL if ttl is None else ttl
    attempts = max(1, _RESOLVER_ATTEMPTS if attempts is None else attempts)
    base_delay = _RESOLVER_BASE_DELAY if base_delay is None else base_delay

    fresh = _cache_get(host)
    if fresh is not None:
        _bump("hits")
        return fresh

    with _host_lock(host):
        # Re-check under the lock: another thread may have filled it while we
        # waited, in which case its lookup is ours too.
        fresh = _cache_get(host)
        if fresh is not None:
            _bump("hits")
            return fresh

        last_exc: Optional[BaseException] = None
        for attempt in range(1, attempts + 1):
            _bump("lookups")
            try:
                addrinfo = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            except socket.gaierror as exc:
                last_exc = exc
                if exc.errno not in _TRANSIENT_GAI_CODES or attempt >= attempts:
                    break
                _bump("retries")
                _SLEEP(backoff_delay(attempt, base_delay, _RESOLVER_MAX_DELAY))
                continue
            except OSError as exc:
                last_exc = exc
                if attempt >= attempts:
                    break
                _bump("retries")
                _SLEEP(backoff_delay(attempt, base_delay, _RESOLVER_MAX_DELAY))
                continue

            now = time.monotonic()
            with _resolver_guard:
                _resolver_cache[host] = (now + ttl, now, addrinfo)
            return addrinfo

        stale = _cache_get(host, allow_stale=True)
        if stale is not None:
            _bump("stale_served")
            log_throttled(
                log,
                f"dns-stale:{host}",
                f"could not resolve {host} ({last_exc}); serving the cached address, "
                f"up to {_RESOLVER_STALE_MAX:.0f}s old",
                min_interval=60.0,
            )
            return stale

        _bump("failures")
        raise last_exc  # type: ignore[misc]


def resolver_stats() -> dict:
    """A snapshot of the resolver counters, for the health endpoint and tests."""
    with _resolver_guard:
        return dict(_resolver_stats)


def reset_resolver(*, clear_stats: bool = False) -> None:
    """Drop cached addresses (and optionally the counters). Tests use this."""
    with _resolver_guard:
        _resolver_cache.clear()
        if clear_stats:
            for key in _resolver_stats:
                _resolver_stats[key] = 0
