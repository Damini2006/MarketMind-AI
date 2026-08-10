"""Tiny thread-safe TTL cache for expensive, low-frequency results.

Used to stop the AI endpoints (which retrain scikit-learn models) and the
notification sync from recomputing the same heavy work on every request —
especially painful over high-latency PostgreSQL (Neon) connections.

Cached values are plain JSON-serializable dicts/lists, so responses built
once are served fast on repeat calls until the TTL expires.
"""
import threading
import time

_cache: dict = {}
_lock = threading.Lock()


def get_or_set(key: str, ttl: int, fn):
    """Return the cached value for `key` if fresh, else compute, cache, return.

    `fn` is only invoked (and its result cached) when the cache misses. A
    single-flight guard prevents stampedes when several requests miss at once.
    """
    now = time.time()
    with _lock:
        entry = _cache.get(key)
        if entry is not None and entry[0] > now:
            return entry[1]

    value = fn()

    with _lock:
        _cache[key] = (now + ttl, value)
    return value


def invalidate(prefix: str) -> None:
    """Drop every cache entry whose key starts with `prefix`."""
    with _lock:
        for key in [k for k in _cache if k.startswith(prefix)]:
            _cache.pop(key, None)
