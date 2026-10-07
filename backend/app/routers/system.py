"""System telemetry - cache hit rates and endpoint latencies.

Exposes in-memory performance stats for the "Performance" card on the
Audit Trail page. All data is derived from this process's memory; nothing
is persisted or sent anywhere.
"""
import threading
import time
from collections import defaultdict

from fastapi import APIRouter, Depends

from ..cache import get_cache_stats, get_or_set
from ..database import get_db
from ..deps import get_current_user, require_roles
from .. import models
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/system", tags=["system"])

# ── request latency tracking (populated by the middleware in main.py) ──
REQUEST_STATS = {
    "count": 0,
    "paths": {},  # path -> {count, total_ms}
}
_STATS_LOCK = threading.Lock()
_STARTED = time.time()


def record_request(path: str, elapsed_ms: float) -> None:
    """Called by the ASGI middleware for every request."""
    with _STATS_LOCK:
        REQUEST_STATS["count"] += 1
        p = REQUEST_STATS["paths"].setdefault(path, {"count": 0, "total_ms": 0.0})
        p["count"] += 1
        p["total_ms"] += elapsed_ms


@router.get("/login-map")
def login_map(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    """Admin-only: login activity across ALL businesses, grouped by location.

    Returns map-able points (location + lat/lng + login count + which
    businesses logged in from there) plus global totals.
    """
    def _load():
        from sqlalchemy import func as sa_func

        total_logins = (
            db.query(sa_func.count(models.AuditLog.id))
            .filter(models.AuditLog.action_type == "login")
            .scalar()
        )
        rows = (
            db.query(
                models.AuditLog.business_id,
                models.AuditLog.location,
                models.AuditLog.latitude,
                models.AuditLog.longitude,
            )
            .filter(
                models.AuditLog.location.isnot(None),
                models.AuditLog.latitude.isnot(None),
                models.AuditLog.longitude.isnot(None),
            )
            .all()
        )
        biz_names = {
            b.id: b.company_name for b in db.query(models.Business.id, models.Business.company_name).all()
        }

        points = defaultdict(lambda: {"location": None, "latitude": None, "longitude": None, "count": 0, "biz_ids": set()})
        for bid, location, lat, lng in rows:
            key = (location, lat, lng)
            p = points[key]
            p["location"], p["latitude"], p["longitude"] = location, lat, lng
            p["count"] += 1
            if bid:
                p["biz_ids"].add(bid)

        items = [
            {
                "location": p["location"],
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "count": p["count"],
                "businesses": sorted({biz_names.get(b, f"Business #{b}") for b in p["biz_ids"]}),
            }
            for p in sorted(points.values(), key=lambda x: -x["count"])
        ]
        return {
            "total_logins": total_logins,
            "businesses": sorted({biz_names[b] for b in biz_names if biz_names[b]}),
            "items": items,
        }

    return get_or_set("system:login_map", 60, _load)


@router.get("/cache-stats")
def cache_stats(current_user=Depends(require_roles("business_owner", "store_manager", "admin"))):
    """In-memory cache hit rates + per-prefix breakdown + endpoint latencies.

    Owner/manager/admin only (mirrors the Audit Trail page's RBAC): latency
    histograms over every API path are an internal-ops signal, not
    sales-executive dashboard material.
    """
    with _STATS_LOCK:
        paths = {}
        for path, p in REQUEST_STATS["paths"].items():
            paths[path] = {
                "count": p["count"],
                "avg_ms": round(p["total_ms"] / p["count"], 1) if p["count"] else 0,
            }
        request_count = REQUEST_STATS["count"]
        uptime = int(time.time() - _STARTED)

    stats = get_cache_stats()
    stats["requests"] = request_count
    stats["process_uptime_seconds"] = uptime
    stats["endpoint_latency_ms"] = dict(
        sorted(paths.items(), key=lambda kv: -kv[1]["avg_ms"])[:25]
    )
    return stats


def _probe_neon() -> dict:
    """Check the live PostgreSQL (Neon) database can answer a query.

    Concurrency-safe-ish: opens a single pooled connection, runs one read-only
    SELECT, and closes it (the pool keeps its free ones warm for real traffic).
    A missing DATABASE_URL or a dead connection raises, so the endpoint reports
    the failure instead of 500ing silently.
    """
    from ..database import SessionLocal, engine
    from sqlalchemy import text

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1 AS ok"))
        return {"ok": True, "host": engine.url.host if engine.url else None}
    except Exception as exc:
        import logging
        logging.error("database probe failed: %s: %s", type(exc).__name__, exc)
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@router.get("/health/deep")
def health_deep(current_user=Depends(require_roles("business_owner", "store_manager", "admin"))):
    """Full deployment smoke test.

    Replaces the one-liner /health with anything an operator or CI pipeline
    actually needs to know about a running instance:

      - /health                  -> 200, {"status":"healthy"}            (public)
      - /api/health              -> 200, same shape                      (public alias)
      - /api/system/health/deep  -> 200, everything below, zero secrets

    deep:
      - db: Neon connectivity. A single SELECT 1 through the pooled
        connection. Serverless Postgres (Neon) suspends idle compute — a
        sleep longer than the pool timeout shows up here as a failure, which
        is the exact symptom "the app went dead after a while" has.
      - cache: in-process warmup. Everything the app precomputes on restart
        (KPIs per business, forecasts, churn models, recommendations, and
        notification sync) is pre-computed by the startup thread — a warm
        process answers this endpoint fast and tender. A cold one reports the
        misses and the compute time the warm-up is supposed to remove.
      - summary: "healthy","degraded", or "unhealthy" from the two above.

    Response keys are plain strings/booleans/numbers so anything can parse them
    — GitHub Actions, Render Health Checks, a Load balancer, the dashboard.
    """
    import time

    t0 = time.perf_counter()
    probe = _probe_neon()
    cache = get_cache_stats()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    cache_warm = cache["computes"] == 0 and cache["hits"] > 0
    # Warm as a process that just started: every AI/caching prefix has real
    # hits and zero computes — the startup thread already did the work.
    # Degraded: warm partially (e.g. telemetry endpoints report from the
    # fallback stats) or the connection probe failed but the process is alive
    # and serving.
    if probe["ok"] and cache_warm:
        status = "healthy"
    elif probe["ok"] and cache["computes"] == 0:
        # Connection is alive, cache is empty — nothing precomputed yet (fresh
        # deploy, first user, warm-up still running).
        status = "healthy" if cache["hits"] == 0 else "degraded"
    else:
        status = "degraded"

    return {
        "status": status,
        "probe": probe,
        "cache": cache,
        "summary": {
            "healthy": probe["ok"] and cache_warm,
            "degraded": status == "degraded",
            "cache_entries": cache["cache_entries"],
            "hits": cache["hits"],
            "misses": cache["misses"],
            "avg_compute_ms": cache["avg_compute_ms"],
            "elapsed_ms": round(elapsed_ms, 1),
        },
    }
