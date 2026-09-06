"""System telemetry — cache hit rates and endpoint latencies.

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
def cache_stats(current_user=Depends(get_current_user)):
    """In-memory cache hit rates + per-prefix breakdown + endpoint latencies."""
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