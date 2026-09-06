"""Tiny thread-safe TTL cache for expensive, low-frequency results.

Used to stop the AI endpoints (which retrain scikit-learn models) and the
notification sync from recomputing the same heavy work on every request —
especially painful over high-latency PostgreSQL (Neon) connections.

Cached values are plain JSON-serializable dicts/lists, so responses built
once are served fast on repeat calls until the TTL expires. Hit/miss and
compute-time stats are tracked per key-prefix for the performance dashboard.
"""
import threading
import time

_cache: dict = {}
_locks: dict = {}
_guard = threading.Lock()

# ── stats ──────────────────────────────────────────────────────────────
# Global + per-prefix (first segment of the key, e.g. "ai") counters.
_STATS = {
    "hits": 0,
    "misses": 0,
    "compute_ms": 0.0,
    "computes": 0,
    "prefixes": {},  # prefix -> {hits, misses, compute_ms, computes}
}
_STARTED = time.time()


def get_or_set(key: str, ttl: int, fn):
    """Return the cached value for `key` if fresh, else compute, cache, return.

    `fn` is only invoked (and its result cached) when the cache misses. A
    per-key lock provides true single-flight: when several requests miss at
    once, only one runs `fn` and the rest wait for it instead of repeating
    the (potentially seconds-long) computation.
    """
    now = time.time()
    with _guard:
        entry = _cache.get(key)
        if entry is not None and entry[0] > now:
            _bump(_prefix(key), hit=True)
            return entry[1]
        key_lock = _locks.get(key)
        if key_lock is None:
            key_lock = _locks[key] = threading.Lock()

    with key_lock:
        # Double-check after acquiring the lock — another thread may have
        # computed and cached while we were waiting.
        now = time.time()
        with _guard:
            entry = _cache.get(key)
            if entry is not None and entry[0] > now:
                _bump(_prefix(key), hit=True)
                return entry[1]
        t0 = time.perf_counter()
        try:
            value = fn()
        finally:
            with _guard:
                _locks.pop(key, None)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        with _guard:
            _cache[key] = (time.time() + ttl, value)
            _bump(_prefix(key), hit=False, elapsed_ms=elapsed_ms)
        return value


def _prefix(key: str) -> str:
    return key.split(":", 1)[0] if ":" in key else key


def _bump(prefix: str, hit: bool, elapsed_ms: float = 0.0) -> None:
    """Caller must hold _guard."""
    p = _STATS["prefixes"].setdefault(
        prefix, {"hits": 0, "misses": 0, "compute_ms": 0.0, "computes": 0}
    )
    if hit:
        _STATS["hits"] += 1
        p["hits"] += 1
    else:
        _STATS["misses"] += 1
        p["misses"] += 1
        _STATS["computes"] += 1
        p["computes"] += 1
        _STATS["compute_ms"] += elapsed_ms
        p["compute_ms"] += elapsed_ms


def invalidate(prefix: str) -> None:
    """Drop every cache entry whose key starts with `prefix`."""
    with _guard:
        for key in [k for k in _cache if k.startswith(prefix)]:
            _cache.pop(key, None)


def get_cache_stats() -> dict:
    """Snapshot of cache performance for the system dashboard."""
    with _guard:
        total = _STATS["hits"] + _STATS["misses"]
        prefixes = {}
        for prefix, p in _STATS["prefixes"].items():
            ptotal = p["hits"] + p["misses"]
            prefixes[prefix] = {
                "hits": p["hits"],
                "misses": p["misses"],
                "hit_rate": round(p["hits"] / ptotal, 3) if ptotal else 0,
                "computes": p["computes"],
                "avg_compute_ms": round(p["compute_ms"] / p["computes"], 1) if p["computes"] else 0,
            }
        return {
            "cache_entries": len(_cache),
            "uptime_seconds": int(time.time() - _STARTED),
            "hits": _STATS["hits"],
            "misses": _STATS["misses"],
            "hit_rate": round(_STATS["hits"] / total, 3) if total else 0,
            "avg_compute_ms": round(_STATS["compute_ms"] / _STATS["computes"], 1)
            if _STATS["computes"]
            else 0,
            "prefixes": prefixes,
        }