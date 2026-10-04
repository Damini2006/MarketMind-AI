"""Endpoint coverage for /api/system/health/deep (DB probe + cache warmth).

The route lives under the `system` router's `/api/system` prefix, and it is
role-gated to owner/manager/admin like the other operator endpoints, so every
request here goes through a real authenticated client rather than calling the
handler directly.

The status rules under test (see `health_deep` in `app/routers/system.py`):
  * probe ok + warm cache (computes == 0 AND hits > 0)      -> "healthy"
  * probe ok + cold cache with no hits yet (fresh deploy)    -> "healthy"
  * probe ok + partial warm-up (hits > 0, computes > 0)      -> "degraded"
  * probe failed                                           -> "degraded"
`summary.healthy` is strictly the first case, so it stays False for a merely
alive-but-cold process.
"""

import pytest
from sqlalchemy import text

from app.routers.system import _probe_neon

DEEP_URL = "/api/system/health/deep"


def _warm_stats():
    return {
        "cache_entries": 7,
        "uptime_seconds": 120,
        "hits": 42,
        "misses": 2,
        "computes": 0,
        "hit_rate": 0.95,
        "avg_compute_ms": 3.2,
        "prefixes": {"ai:": {"count": 7, "avg_ms": 3.2}},
    }


def _cold_stats():
    """A process that just started: nothing precomputed, nothing hit yet."""
    return {
        "cache_entries": 0,
        "uptime_seconds": 3,
        "hits": 0,
        "misses": 0,
        "computes": 0,
        "hit_rate": 0,
        "avg_compute_ms": 0,
        "prefixes": {},
    }


def _warming_stats():
    """Warm-up still running: some hits already landed, computes still pending."""
    return {
        "cache_entries": 3,
        "uptime_seconds": 8,
        "hits": 4,
        "misses": 6,
        "computes": 5,
        "hit_rate": 0.4,
        "avg_compute_ms": 41.0,
        "prefixes": {"ai:": {"count": 3, "avg_ms": 41.0}},
    }


@pytest.fixture()
def warm_cache(monkeypatch):
    from app.routers import system as system_mod

    monkeypatch.setattr(system_mod, "get_cache_stats", _warm_stats)


@pytest.fixture()
def cold_cache(monkeypatch):
    from app.routers import system as system_mod

    monkeypatch.setattr(system_mod, "get_cache_stats", _cold_stats)


@pytest.fixture()
def warming_cache(monkeypatch):
    from app.routers import system as system_mod

    monkeypatch.setattr(system_mod, "get_cache_stats", _warming_stats)


# ── _probe_neon ──────────────────────────────────────────────────────────


def test_probe_neon_returns_ok_and_host():
    result = _probe_neon()
    assert isinstance(result, dict)
    assert "ok" in result
    # Exactly one of the two shapes, never both: host on success, error on
    # failure. A caller can branch on `ok` alone.
    assert ("host" in result) != ("error" in result)


def test_probe_neon_actually_queries_the_database():
    """`ok` must mean a round-trip happened, not that a connection was opened."""
    from app.database import SessionLocal

    with SessionLocal() as db:
        assert db.execute(text("SELECT 1 AS ok")).scalar() == 1
    assert _probe_neon()["ok"] is True


def test_probe_neon_error_shape_on_failure(monkeypatch):
    from app.database import SessionLocal

    def boom():
        raise RuntimeError("connection refused")

    monkeypatch.setattr(
        "app.routers.system.SessionLocal", boom, raising=False
    )
    # Patch the name the helper resolves at call time.
    import app.database as db_mod

    monkeypatch.setattr(db_mod, "SessionLocal", boom)

    result = _probe_neon()
    assert result["ok"] is False
    assert "error" in result and "host" not in result
    assert "RuntimeError" in result["error"]


# ── health_deep over HTTP ────────────────────────────────────────────────


def test_health_deep_requires_auth(client):
    assert client.get(DEEP_URL).status_code == 401


def test_health_deep_forbidden_for_sales_exec(client, sales_headers):
    assert client.get(DEEP_URL, headers=sales_headers).status_code == 403


def test_health_deep_returns_200_and_shape(client, owner_headers, warm_cache):
    res = client.get(DEEP_URL, headers=owner_headers)
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["status"] in ("healthy", "degraded")
    assert set(body) == {"status", "probe", "cache", "summary"}

    # The probe reports one of two mutually exclusive shapes.
    assert ("host" in body["probe"]) != ("error" in body["probe"])
    assert body["probe"]["ok"] is True

    # Cache block is forwarded verbatim from get_cache_stats.
    assert set(body["cache"]) >= {"cache_entries", "hits", "misses", "hit_rate", "prefixes"}

    summary = body["summary"]
    assert set(summary) == {
        "healthy", "degraded", "cache_entries",
        "hits", "misses", "avg_compute_ms", "elapsed_ms",
    }
    assert summary["healthy"] is True
    assert summary["degraded"] is False
    assert summary["cache_entries"] == 7
    assert summary["elapsed_ms"] >= 0

    # Everything must be JSON-safe so a CI runner or a load balancer can parse
    # it without knowing anything about SQLAlchemy.
    assert isinstance(body["status"], str)
    assert isinstance(body["probe"]["ok"], bool)
    assert isinstance(summary["avg_compute_ms"], (int, float))


def test_health_deep_healthy_when_warm_and_connected(client, owner_headers, warm_cache):
    res = client.get(DEEP_URL, headers=owner_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["summary"]["healthy"] is True
    assert body["summary"]["degraded"] is False


def test_health_deep_healthy_but_not_warm_on_a_fresh_process(client, owner_headers, cold_cache):
    """No cached data yet is not a failure -- it is a cold start."""
    body = client.get(DEEP_URL, headers=owner_headers).json()
    assert body["status"] == "healthy"
    # ...but the process has not actually warmed up, so summary says so.
    assert body["summary"]["healthy"] is False
    assert body["summary"]["cache_entries"] == 0


def test_health_deep_degraded_while_warmup_is_still_running(client, owner_headers, warming_cache):
    body = client.get(DEEP_URL, headers=owner_headers).json()
    assert body["status"] == "degraded"
    assert body["summary"]["degraded"] is True
    # The DB is fine; only the warm-up lags.
    assert body["probe"]["ok"] is True


def test_health_deep_degraded_when_db_probe_fails(client, owner_headers, warm_cache, monkeypatch):
    from app.routers import system as system_mod

    monkeypatch.setattr(
        system_mod,
        "_probe_neon",
        lambda: {"ok": False, "error": "OperationalError: server closed the connection"},
    )
    body = client.get(DEEP_URL, headers=owner_headers).json()
    assert body["status"] == "degraded"
    assert body["probe"]["ok"] is False
    assert "error" in body["probe"]
