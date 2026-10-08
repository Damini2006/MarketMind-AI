#!/usr/bin/env python3
"""Deploy smoke test for the MarketMind AI stack.

Answers "is the deployed stack actually usable?", not merely "are the containers
up?". It makes real HTTP calls against the live services and exits non-zero if
any check fails, so a deploy can be gated on it.

Checks, in order:

  1. backend  GET  /health                  -> 200 {"status": "healthy"}
  2. backend  GET  /openapi.json            -> 200, schema carries the expected
                                               routes (catches a half-broken app)
  3. frontend GET  /                        -> 200 and the SPA shell is really
                                               served (title + #root), not a
                                               directory listing or a 404 page
  4. frontend GET  /api/health              -> 200 healthy. This is the path the
                                               browser uses, so it proves the
                                               nginx -> backend proxy is wired.
  5. backend  POST /api/auth/login          -> 200 + access token
  6. backend  GET  /api/auth/me  (token)    -> 200 and the same identity, i.e.
                                               the token actually works
  7. backend  GET  /api/system/health/deep  -> 200 with probe.ok true, i.e. the
                                               app can reach its own database
  8. backend  GET  /api/auth/me  (no token) -> 401, i.e. auth is enforced
                                               (a "healthy" stack that serves
                                               protected data to anonymous
                                               callers is not healthy)

Why this is NOT the container healthcheck
-----------------------------------------
Login is rate limited to 10 attempts per IP per 300s (see
``app/routers/auth.py``: ``_check_rate_limit(f"login:{ip}", max_attempts=10,
window=300)``). Running this on a healthcheck interval of 10s would issue ~30
logins per window and get answered with 429, so the cheap ``curl /health`` in
docker-compose.yml stays the healthcheck and this runs as a one-shot gate:

    docker compose --profile smoke run --rm smoke   # against the compose stack
    python scripts/smoke_test.py                    # against localhost

Configuration (flags override environment, environment overrides defaults)
-------------------------------------------------------------------------
    --backend   / SMOKE_BACKEND_URL    default http://localhost:8000
    --frontend  / SMOKE_FRONTEND_URL   default http://localhost:3000
    --email     / SMOKE_EMAIL          default the seeded demo owner
    --password  / SMOKE_PASSWORD       default the seeded demo password

The credential defaults are the demo account seeded by ``app/seed_data.py``,
which is already public in that file. For a real environment pass real
credentials (prefer the environment variables over ``--password``, which would
show up in a process listing). The password is never echoed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BACKEND = os.getenv("SMOKE_BACKEND_URL", "http://localhost:8000")
DEFAULT_FRONTEND = os.getenv("SMOKE_FRONTEND_URL", "http://localhost:3000")
DEFAULT_EMAIL = os.getenv("SMOKE_EMAIL", "owner@marketmind.ai")
DEFAULT_PASSWORD = os.getenv("SMOKE_PASSWORD", "Owner@123")

# Markers the built SPA shell must contain. If the frontend serves an empty
# directory or an nginx default page these are absent, which is exactly the
# failure mode a bare 200 would hide.
FRONTEND_MARKERS = ("<title>MarketMind AI</title>", 'id="root"')

# A route count floor. The app exposes 75 paths today; asserting a floor rather
# than the exact number catches a truncated/broken app without breaking every
# time a route is added.
MIN_OPENAPI_ROUTES = 50
REQUIRED_OPENAPI_ROUTE = "/api/auth/login"

# Login retries stay well under the 10-per-300s limit: a FRESH deploy legitimately
# has no demo account for a moment while the startup seed runs, so one retry
# loop is needed, but more than a handful would trip the limiter.
LOGIN_ATTEMPTS = 4
LOGIN_RETRY_DELAY = 5.0


class HttpResult:
    """A response, or the reason there wasn't one. Never raises for HTTP status."""

    __slots__ = ("status", "body", "error")

    def __init__(self, status, body=b"", error=None):
        self.status = status
        self.body = body
        self.error = error

    @property
    def ok(self):
        return self.status is not None and 200 <= self.status < 300

    def json(self):
        try:
            return json.loads(self.body.decode("utf-8"))
        except Exception:
            return None

    def text(self):
        return self.body.decode("utf-8", errors="replace")

    def snippet(self, limit=100):
        body = self.text().strip().replace("\n", " ")
        return body[:limit] + ("..." if len(body) > limit else "")

    def describe(self):
        if self.error:
            return f"no response ({self.error})"
        return f"HTTP {self.status}"


def request(method, url, *, token=None, payload=None, timeout=30.0):
    """Perform one HTTP request, converting every failure into an HttpResult."""
    data = None
    headers = {"Accept": "application/json, text/html"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return HttpResult(resp.status, resp.read())
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read()
        except Exception:
            body = b""
        return HttpResult(exc.code, body)
    except Exception as exc:  # connection refused, DNS, timeout, ...
        return HttpResult(None, b"", error=f"{type(exc).__name__}: {exc}")


class Report:
    def __init__(self, verbose=False):
        self.results = []
        self.verbose = verbose

    def check(self, name, ok, detail=""):
        self.results.append((name, bool(ok), detail))
        marker = "PASS" if ok else "FAIL"
        print(f"  {marker}  {name:<44} {detail}")
        return bool(ok)

    @property
    def failed(self):
        return [r for r in self.results if not r[1]]

    def summary(self):
        total = len(self.results)
        bad = len(self.failed)
        print()
        print(f"{total - bad}/{total} checks passed")
        if bad:
            print("FAILED:")
            for name, _, detail in self.failed:
                print(f"  - {name}: {detail}")
        return 1 if bad else 0


def wait_until_ready(url, timeout, label, verbose=False):
    """Poll ``url`` until it answers 2xx or the budget runs out."""
    deadline = time.monotonic() + timeout
    last = "no attempt"
    while True:
        res = request("GET", url, timeout=min(10.0, max(2.0, timeout)))
        if res.ok:
            if verbose:
                print(f"  .. {label} ready after polling")
            return True, res
        last = res.describe()
        if time.monotonic() >= deadline:
            return False, last
        time.sleep(2)


def login(backend, email, password, verbose=False):
    """Log in, tolerating a fresh deploy whose seed has not finished yet.

    Retries on 401/404 as well as on connection errors, but never on 429: that
    is the rate limiter telling us to stop, and retrying would make it worse.
    Returns (token, last_response) so the caller can report the real status.
    """
    url = f"{backend}/api/auth/login"
    last = HttpResult(None, b"", error="no attempt made")
    for attempt in range(1, LOGIN_ATTEMPTS + 1):
        res = request("POST", url, payload={"email": email, "password": password}, timeout=30.0)
        last = res
        if res.ok:
            token = (res.json() or {}).get("access_token")
            if token:
                return token, res
            last = HttpResult(res.status, res.body, error="200 but no access_token in the body")
        elif res.status == 429:
            return None, res  # do not retry into the limiter
        if attempt < LOGIN_ATTEMPTS:
            if verbose:
                print(f"  .. login attempt {attempt}/{LOGIN_ATTEMPTS} failed ({res.describe()}); retrying")
            time.sleep(LOGIN_RETRY_DELAY)
    return None, last


def run(backend, frontend, email, password, ready_timeout, verbose):
    backend = backend.rstrip("/")
    frontend = frontend.rstrip("/")
    report = Report(verbose=verbose)

    print(f"backend : {backend}")
    print(f"frontend: {frontend}")
    print(f"account : {email}")
    print()

    # ── readiness: give a freshly started stack a chance to answer ──────────
    if ready_timeout > 0:
        ok, _ = wait_until_ready(f"{backend}/health", ready_timeout, "backend", verbose)
        if not ok:
            report.check("backend reachable", False, "timed out waiting for /health")
            return report.summary()
        wait_until_ready(frontend + "/", ready_timeout, "frontend", verbose)

    # ── 1. backend liveness ─────────────────────────────────────────────────
    res = request("GET", f"{backend}/health", timeout=20.0)
    body = res.json() if res.ok else None
    report.check(
        "/health returns healthy",
        res.ok and body == {"status": "healthy"},
        f"{res.describe()}" + (f" {res.snippet(60)}" if not res.ok else ""),
    )

    # ── 2. OpenAPI schema ───────────────────────────────────────────────────
    res = request("GET", f"{backend}/openapi.json", timeout=30.0)
    spec = res.json() if res.ok else None
    paths = sorted(spec.get("paths", {})) if isinstance(spec, dict) else []
    if not res.ok:
        report.check("/openapi.json served", False, res.describe())
    elif not paths:
        report.check("/openapi.json served", False, "200 but no paths in the schema")
    elif len(paths) < MIN_OPENAPI_ROUTES:
        report.check(
            "/openapi.json served",
            False,
            f"only {len(paths)} paths (< {MIN_OPENAPI_ROUTES}); app looks truncated",
        )
    elif REQUIRED_OPENAPI_ROUTE not in paths:
        report.check("/openapi.json served", False, f"schema is missing {REQUIRED_OPENAPI_ROUTE}")
    else:
        report.check("/openapi.json served", True, f"200, {len(paths)} paths")

    # ── 3. frontend shell ───────────────────────────────────────────────────
    res = request("GET", frontend + "/", timeout=20.0)
    text = res.text() if res.status is not None else ""
    missing = [m for m in FRONTEND_MARKERS if m not in text]
    report.check(
        "frontend serves the SPA shell",
        res.ok and not missing,
        res.describe() + ("" if res.ok and not missing else f" missing {missing}"),
    )

    # ── 4. nginx -> backend proxy (the path the browser uses) ───────────────
    res = request("GET", f"{frontend}/api/health", timeout=20.0)
    body = res.json() if res.ok else None
    report.check(
        "frontend proxies /api/health to the backend",
        res.ok and body == {"status": "healthy"},
        f"{res.describe()}" + (f" {res.snippet(60)}" if not res.ok else ""),
    )

    # ── 5. authenticated login ──────────────────────────────────────────────
    token, res = login(backend, email, password, verbose=verbose)
    if token:
        report.check("authenticated login succeeds", True, "200, token issued")
    else:
        detail = res.describe()
        if res.status == 429:
            detail += " (rate limited - too many login attempts from this IP)"
        report.check("authenticated login succeeds", False, detail)

    # ── 6/7/8. everything below needs the token ─────────────────────────────
    if token:
        res = request("GET", f"{backend}/api/auth/me", token=token, timeout=20.0)
        me = res.json() if res.ok else None
        report.check(
            "authenticated GET /api/auth/me",
            res.ok and isinstance(me, dict) and me.get("email") == email,
            res.describe() + (f" {res.snippet(80)}" if not res.ok else " identity matches"),
        )

        res = request("GET", f"{backend}/api/system/health/deep", token=token, timeout=120.0)
        deep = res.json() if res.ok else None
        probe = (deep or {}).get("probe", {}) if isinstance(deep, dict) else {}
        # NOTE: deliberately asserting probe.ok only. `status` is not usable as a
        # pass/fail signal here: health_deep reports "degraded" for any process
        # that has computed a cache entry (its healthy rule needs computes == 0),
        # which is always true after the startup warm-up.
        if res.ok and probe.get("ok") is True:
            report.check(
                "authenticated database round-trip",
                True,
                f"200, probe ok (host {probe.get('host')})",
            )
        else:
            report.check(
                "authenticated database round-trip",
                False,
                f"{res.describe()} probe={probe or res.snippet(120)}",
            )
    else:
        report.check("authenticated GET /api/auth/me", False, "skipped: no token")
        report.check("authenticated database round-trip", False, "skipped: no token")

    # ── 8. auth is actually enforced ────────────────────────────────────────
    res = request("GET", f"{backend}/api/auth/me", timeout=20.0)
    report.check(
        "protected endpoint rejects anonymous callers",
        res.status == 401,
        f"expected 401, got {res.describe()}",
    )

    return report.summary()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Smoke test a running MarketMind AI stack.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--backend", default=DEFAULT_BACKEND, help="backend base URL")
    parser.add_argument("--frontend", default=DEFAULT_FRONTEND, help="frontend base URL")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="account to authenticate as")
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="account password (prefer the SMOKE_PASSWORD env var)",
    )
    parser.add_argument(
        "--ready-timeout",
        type=float,
        default=60.0,
        help="seconds to wait for the stack to answer before testing (0 to skip)",
    )
    parser.add_argument("--verbose", action="store_true", help="show retry/readiness detail")
    args = parser.parse_args(argv)

    try:
        return run(
            args.backend,
            args.frontend,
            args.email,
            args.password,
            args.ready_timeout,
            args.verbose,
        )
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
