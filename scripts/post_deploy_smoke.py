#!/usr/bin/env python3
"""Post-deploy smoke check for the PUBLIC deployment.

Answers the one question the other gates cannot: is the URL the world can reach
actually running THIS commit's build, with its API wired up behind it?
``scripts/smoke_test.py`` proves the stack works on one machine; this proves the
promoted deployment does.

Two failure modes it exists to catch, both of which happened here for real:

  1. The deployment is stale, or was never promoted, so the served bundle is not
     the one this commit builds. Vite content-hashes the entry chunk
     (``/assets/index-<hash>.js``), so comparing that hash against a build of the
     same commit is an exact identity check rather than a heuristic. This is how
     a domain still serving a 23-hour-old build was caught — it looked fine,
     because it answered 200 with a working-looking page.

  2. ``/api/...`` is answered by the SPA fallback with ``200 text/html`` instead
     of by the backend. A catch-all rewrite such as
     ``{"source": "/(.*)", "destination": "/index.html"}`` swallows the API
     paths whenever the API rule is missing or ordered after it, so every status
     code still looks healthy while the app receives an HTML document where it
     expects JSON. Both production domains were in exactly this state.

Amusing detail worth keeping: on the stale domain ``/api/health`` answered
``200 application/json`` while ``/api/sales/`` answered ``200 text/html``. A
health-only check would have passed. That is why the default probe is a real
data path — ``/api/sales/`` is the one that discriminates.

Authenticated page checks: Compare Periods and Funnel Analysis
-------------------------------------------------------------
The checks above are anonymous, which is most of what a deploy can get wrong.
The rest is the app working for a signed-in user who is NOT an owner: a 401 or
an empty payload still renders a page, so it fails silently. So when demo
credentials are supplied (repository secrets — see below) this logs in as the
read-only demo account and asserts that the data behind the two analysis pages
really loads, over the public origin, through the same ``/api`` rewrite:

  * **Compare Periods** — ``frontend/src/pages/Comparison.jsx`` fetches
    ``/api/sales/``, ``/api/invoices/`` and ``/api/inventory/products``.
  * **Funnel Analysis** — ``frontend/src/pages/FunnelAnalysis.jsx`` fetches
    ``/api/customers/``, ``/api/sales/`` and ``/api/inventory/products``.

Neither page has an endpoint of its own: both compute their analysis in the
browser, so what a deploy can break is the data they read. Each path must return
a non-empty list — a payload the frontend's own ``toList()`` helper would render
as an empty page is treated as a failure, because a page that loads and shows
nothing looks exactly like a page whose data never arrived.

The read-only part is asserted too, not assumed: the account must be refused
(403) by a write endpoint it has no business calling, so credentials that turn
out to belong to a second owner fail loudly instead of passing quietly.

Credentials come from secrets and are never defaulted in this file:

    POST_DEPLOY_DEMO_EMAIL / --demo-email
    POST_DEPLOY_DEMO_PASSWORD / --demo-password

With neither set the authenticated checks are SKIPPED, with a ``::warning::``
annotation on the run — the deploy is not failed for a secret that may simply
not be configured yet, but a skipped check is never reported as a pass. Setting
one without the other IS a failure, because that is a misconfigured secret
rather than an absent one. In production the demo accounts are not seeded
(``ENVIRONMENT=production`` turns seeding off), so these must be real
credentials for a restricted account that belongs to a tenant with data.

The bundle match is REQUIRED, never inferred from the live page
----------------------------------------------------------------
Inferring "the expected bundle" from the deployment would compare the
deployment to itself and pass while it serves an old build. Build first, then
compare:

    cd frontend && npm ci && npm run build
    python3 scripts/post_deploy_smoke.py \\
      --url https://frontend-xi-ashy-73.vercel.app \\
      --expected-bundle "$(grep -oE '/assets/index-[^"]+\\.js' dist/index.html | head -1)"

Because a deployment takes a moment to be promoted after a push, the bundle
check polls until it matches or ``--timeout`` elapses, then fails with what it
actually saw.

Configuration (flags override environment, environment overrides defaults)
-------------------------------------------------------------------------
    --url              / POST_DEPLOY_URL             default the production site
    --expected-bundle  / POST_DEPLOY_EXPECTED_BUNDLE required, no default
    --api-path         / POST_DEPLOY_API_PATH        default /api/sales/
                                                     (repeatable)
    --demo-email       / POST_DEPLOY_DEMO_EMAIL      no default: unset skips the
                                                     authenticated page checks
    --demo-password    / POST_DEPLOY_DEMO_PASSWORD   no default
    --min-rows                                       default 1: rows each page
                                                     data path must return
    --timeout                                        default 420s
    --interval                                       default 10s

Exits 0 only when every check passes. Each failure is printed as a
``::error::`` line so it surfaces as an annotation on the GitHub Actions run
instead of hiding in the log.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_URL = "https://frontend-xi-ashy-73.vercel.app"
DEFAULT_API_PATH = "/api/sales/"
USER_AGENT = "marketmind-post-deploy-smoke/1.0"
ENTRY_BUNDLE_RE = re.compile(r'src="(/assets/[^"]+\.js)"')

# ── the two analysis pages, and the data they actually read ─────────────────
# Same paths, in the same order, as the components fetch them. They are asserted
# through the public origin, so the /api rewrite is exercised for authenticated
# calls too — the anonymous /api/sales/ probe covers the same rewrite, but a
# rewrite can be right for one path and wrong for another (a more specific rule
# can shadow a broader one).
PAGE_DATA_SOURCES = (
    (
        "Compare Periods",
        ("/api/sales/", "/api/invoices/", "/api/inventory/products"),
    ),
    (
        "Funnel Analysis",
        ("/api/customers/", "/api/sales/", "/api/inventory/products"),
    ),
)

# A list payload is either a bare array or one of these keys. This mirrors the
# frontend's toList() helper, deliberately: a payload that helper would render as
# an empty page must not be accepted here as "fine".
ROWS_KEYS = ("items", "data", "results", "rows")

# Where the read-only account must be refused. POST (writing) a product needs
# business_owner/store_manager/admin (app/routers/inventory.py), and the empty
# body cannot create anything even if that guard were wrong — so this proves the
# credential is genuinely unprivileged without being able to mutate the tenant.
READ_ONLY_PROBE_METHOD = "POST"
READ_ONLY_PROBE_PATH = "/api/inventory/products"

# Rate limited to 10 logins per IP per 300s (app/routers/auth.py). One run uses
# one successful login; the retries only cover the window right after a deploy
# where the seed/migrations may not have finished.
LOGIN_ATTEMPTS = 3
LOGIN_RETRY_DELAY = 5.0


class Response:
    """An HTTP result, including the ones that never produced a status."""

    __slots__ = ("status", "content_type", "body", "error")

    def __init__(self, status=None, content_type="", body=b"", error=""):
        self.status = status
        self.content_type = content_type
        self.body = body
        self.error = error

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", "replace")

    @property
    def json(self):
        """Parsed body, or None when it is not JSON at all."""
        try:
            return json.loads(self.text)
        except ValueError:
            return None

    def describe(self) -> str:
        if self.status is None:
            return f"unreachable ({self.error})"
        return f"HTTP {self.status} {self.content_type or '<no content-type>'}"


def request(url: str, method: str = "GET", payload=None, token: str = None,
            timeout: float = 20.0) -> Response:
    """Call a URL without raising: a failure is a Response, not an exception."""
    data = None
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json, */*"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return Response(resp.status, resp.headers.get("Content-Type", ""), resp.read())
    except urllib.error.HTTPError as exc:
        headers = exc.headers or {}
        return Response(exc.code, headers.get("Content-Type", ""), exc.read())
    except Exception as exc:  # noqa: BLE001 - DNS, TLS and timeouts all mean "unreachable"
        return Response(None, "", b"", f"{type(exc).__name__}: {exc}")


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.skipped: list[str] = []
        self.checked = 0

    def ok(self, name: str, detail: str = "") -> None:
        self.checked += 1
        print(f"  ok   {name}" + (f"  [{detail}]" if detail else ""))

    def fail(self, name: str, detail: str) -> None:
        self.checked += 1
        self.failures.append(name)
        print(f"  FAIL {name}  [{detail}]")
        # Annotate the run: a smoke failure should be impossible to miss.
        print(f"::error title=post-deploy smoke: {name}::{detail}")

    def skip(self, name: str, reason: str) -> None:
        """Record a check that could not run. Never counted as a pass."""
        self.skipped.append(name)
        print(f"  SKIP {name}  [{reason}]")
        print(f"::warning title=post-deploy smoke skipped: {name}::{reason}")

    def summary(self) -> int:
        print()
        if self.failures:
            print(f"{len(self.failures)} of {self.checked} checks FAILED:", file=sys.stderr)
            for name in self.failures:
                print(f"  - {name}", file=sys.stderr)
            return 1
        tail = f", {len(self.skipped)} skipped" if self.skipped else ""
        print(f"all {self.checked} checks passed{tail}")
        return 0


def split_content_type(raw: str) -> str:
    return (raw or "").split(";")[0].strip().lower()


def list_rows(payload):
    """The rows in a list payload, or None when it is not a list payload.

    ``[]`` is a valid answer (zero rows) and is distinct from ``None`` (the body
    is not a list at all, e.g. an HTML document or an error object) — the first
    is an empty tenant, the second is a broken contract.
    """
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ROWS_KEYS:
            if isinstance(payload.get(key), list):
                return payload[key]
    return None


def wait_for_bundle(
    url: str, expected: str, timeout: float, interval: float, report: Report, verbose: bool
) -> None:
    """Poll until the live page references the bundle this commit builds."""
    deadline = time.monotonic() + timeout
    attempt = 0
    detail = "no attempt made"
    while True:
        attempt += 1
        # Cache-bust: a CDN or the browser would otherwise keep serving the
        # previous document and the check would never see the new bundle.
        res = request(f"{url.rstrip('/')}/?smoke={int(time.time())}")
        if res.status is None or res.status >= 400:
            detail = f"GET / -> {res.describe()}"
        else:
            seen = ENTRY_BUNDLE_RE.findall(res.text)
            if expected in seen:
                report.ok("served bundle is this build", f"{expected}, after {attempt} attempt(s)")
                return
            detail = (
                f"expected {expected}; the live page references "
                f"{seen if seen else 'no /assets/*.js script'}"
            )
        if time.monotonic() >= deadline:
            report.fail(
                "served bundle is this build",
                f"{detail}; still wrong after {timeout:.0f}s ({attempt} attempts). "
                "A deployment for this commit was probably never promoted; check the "
                "hosting dashboard before assuming the code is at fault.",
            )
            return
        if verbose or attempt == 1:
            print(f"     ... waiting for the deployment to catch up: {detail}")
        time.sleep(interval)


def check_entry_asset(url: str, expected: str, report: Report) -> None:
    res = request(f"{url.rstrip('/')}{expected}")
    report_ok = res.status == 200 and "text/html" not in split_content_type(res.content_type)
    if report_ok:
        report.ok("entry bundle is actually fetchable", res.describe())
    else:
        report.fail(
            "entry bundle is actually fetchable",
            f"{expected} -> {res.describe()}: the HTML references a file the "
            "deployment does not serve",
        )


def check_api(url: str, api_path: str, report: Report) -> None:
    """The API path must be answered by the API, never by the SPA fallback."""
    res = request(f"{url.rstrip('/')}{api_path}")
    content_type = split_content_type(res.content_type)
    name = f"{api_path} is answered by the API"

    if res.status is None:
        report.fail(name, res.describe())
        return
    if "text/html" in content_type:
        report.fail(
            name,
            f"{res.describe()}: the SPA fallback is answering API paths, so the app "
            f"receives HTML where it expects JSON. The /api rewrite is missing or "
            f"ordered after the catch-all rewrite in frontend/vercel.json. "
            f"First bytes: {res.text[:120]!r}",
        )
        return
    try:
        payload = json.loads(res.text)
    except ValueError:
        report.fail(
            name,
            f"{res.describe()}: body is not JSON ({res.text[:120]!r})",
        )
        return
    # 401 is the healthy answer here: reachable, and auth is enforced. 404 means
    # the route is gone, and 5xx means the backend is failing behind a proxy
    # that is technically working.
    if res.status == 404 or res.status >= 500:
        report.fail(
            name,
            f"{res.describe()} from the backend: {json.dumps(payload)[:160]}",
        )
        return
    # Say what the status means, and only when it means something: 401 is the
    # healthy answer to an anonymous call, 2xx means the route is public.
    note = " (401 = reachable and auth-gated)" if res.status == 401 else ""
    report.ok(name, f"{res.describe()}{note}")


def login(url: str, email: str, password: str, report: Report, verbose: bool):
    """Authenticate as the demo account. Returns (token, role, last response).

    Retries a connection error or a 5xx (a deploy can be mid-restart), but never
    a 401 — that is a wrong credential, and retrying it only feeds the per-account
    lockout in app/routers/auth.py.
    """
    endpoint = f"{url.rstrip('/')}/api/auth/login"
    last = Response(None, "", b"", "no attempt made")
    for attempt in range(1, LOGIN_ATTEMPTS + 1):
        res = request(endpoint, method="POST", payload={"email": email, "password": password},
                      timeout=30.0)
        last = res
        if res.status in (401, 403, 429):
            return None, None, res
        body = res.json
        if res.status is not None and 200 <= res.status < 300 and isinstance(body, dict):
            token = body.get("access_token")
            if token:
                role = (body.get("user") or {}).get("role")
                return token, role, res
            last = Response(res.status, res.content_type, res.body,
                            "200 but no access_token in the body")
        if attempt < LOGIN_ATTEMPTS:
            if verbose:
                print(f"     ... login attempt {attempt}/{LOGIN_ATTEMPTS} failed "
                      f"({last.describe()}); retrying")
            time.sleep(LOGIN_RETRY_DELAY)
    return None, None, last


def check_demo_account(url: str, email: str, password: str, report: Report, verbose: bool):
    """Log in as the demo account and assert it is authenticated AND restricted.

    Returns the token (or None), so the page checks can run even if the read-only
    probe fails: a privileged credential is a configuration problem, but the data
    is still worth checking.
    """
    token, role, res = login(url, email, password, report, verbose)
    if not token:
        detail = res.describe()
        if res.status in (401, 403):
            detail += (" — the deployed environment does not have this account (in "
                       "production the demo accounts are not seeded), or the secret "
                       "holds the wrong password")
        elif res.status == 429:
            detail += " (rate limited: 10 logins per IP per 300s)"
        report.fail("read-only demo account can log in", f"{email}: {detail}")
        return None
    report.ok("read-only demo account can log in", f"{email}, role={role}")

    probe = request(f"{url.rstrip('/')}{READ_ONLY_PROBE_PATH}", method=READ_ONLY_PROBE_METHOD,
                    payload={}, token=token, timeout=20.0)
    name = "demo account is read-only (write refused)"
    if probe.status == 403:
        report.ok(name, f"{READ_ONLY_PROBE_METHOD} {READ_ONLY_PROBE_PATH} -> 403")
    else:
        report.fail(
            name,
            f"{READ_ONLY_PROBE_METHOD} {READ_ONLY_PROBE_PATH} -> {probe.describe()}; expected 403. "
            "A 2xx or 422 means the role guard did not reject this account, so it is "
            "not the unprivileged demo account these checks are meant to use. "
            f"{probe.text[:120]!r}",
        )
    return token


def check_page_data(url: str, token: str, report: Report, min_rows: int) -> None:
    """Every path the two analysis pages read must return real rows."""
    base = url.rstrip("/")
    for page, paths in PAGE_DATA_SOURCES:
        for path in paths:
            name = f"{page}: {path} returns rows"
            res = request(f"{base}{path}", token=token, timeout=60.0)
            if res.status is None:
                report.fail(name, res.describe())
                continue
            if res.status in (401, 403):
                report.fail(
                    name,
                    f"{res.describe()}: the demo account cannot read this path, so the "
                    f"page would render empty for that role",
                )
                continue
            if not (200 <= res.status < 300):
                report.fail(name, f"{res.describe()}: {res.text[:160]!r}")
                continue
            payload = res.json
            if payload is None:
                report.fail(
                    name,
                    f"{res.describe()}: body is not JSON, so the page's fetch would "
                    f"throw. First bytes: {res.text[:120]!r}",
                )
                continue
            rows = list_rows(payload)
            if rows is None:
                report.fail(
                    name,
                    f"{res.describe()}: payload is not a list or a list envelope "
                    f"({sorted(ROWS_KEYS)}). First bytes: {res.text[:120]!r}",
                )
                continue
            if len(rows) < min_rows:
                report.fail(
                    name,
                    f"{res.describe()}: {len(rows)} rows, expected at least {min_rows}. "
                    "The page loads but has nothing to show — check that this account "
                    "belongs to a tenant with data.",
                )
                continue
            report.ok(name, f"{len(rows)} rows")


def run(url: str, expected: str, api_paths: list[str], timeout: float, interval: float,
        verbose: bool, demo_email: str = None, demo_password: str = None,
        min_rows: int = 1) -> int:
    report = Report()
    print(f"Post-deploy smoke check against {url}")
    print(f"  this build's entry bundle: {expected}")
    print()

    wait_for_bundle(url, expected, timeout, interval, report, verbose)
    check_entry_asset(url, expected, report)
    for api_path in api_paths:
        check_api(url, api_path, report)

    # ── authenticated page checks ───────────────────────────────────────────
    print()
    if demo_email and demo_password:
        token = check_demo_account(url, demo_email, demo_password, report, verbose)
        if token:
            check_page_data(url, token, report, min_rows)
        else:
            # Report every check that did not run rather than silently dropping
            # them: "0 failures" must not be readable as "the pages work".
            for page, paths in PAGE_DATA_SOURCES:
                for path in paths:
                    report.skip(f"{page}: {path} returns rows", "no demo session")
    elif demo_email or demo_password:
        report.fail(
            "demo credentials are complete",
            "only one of POST_DEPLOY_DEMO_EMAIL / POST_DEPLOY_DEMO_PASSWORD is set. "
            "Set both (repository secrets) or neither.",
        )
    else:
        report.skip(
            "authenticated page checks (Compare Periods, Funnel Analysis)",
            "no demo credentials: set the POST_DEPLOY_DEMO_EMAIL and "
            "POST_DEPLOY_DEMO_PASSWORD repository secrets to run them",
        )

    return report.summary()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Post-deploy smoke check: is the public deployment this build, with a live API?",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--url", default=os.environ.get("POST_DEPLOY_URL", DEFAULT_URL),
                        help="public site base URL")
    parser.add_argument("--expected-bundle",
                        default=os.environ.get("POST_DEPLOY_EXPECTED_BUNDLE"),
                        help="entry bundle path from a fresh build, e.g. /assets/index-abc123.js")
    parser.add_argument("--api-path", action="append", dest="api_paths", default=None,
                        metavar="PATH",
                        help="API path that must answer JSON (repeatable)")
    parser.add_argument("--demo-email",
                        default=os.environ.get("POST_DEPLOY_DEMO_EMAIL"),
                        help="read-only demo account; unset skips the authenticated checks")
    parser.add_argument("--demo-password",
                        default=os.environ.get("POST_DEPLOY_DEMO_PASSWORD"),
                        help="demo account password (prefer the secret/env over this flag)")
    parser.add_argument("--min-rows", type=int, default=1,
                        help="rows each page data path must return to count as real")
    parser.add_argument("--timeout", type=float, default=420.0,
                        help="seconds to wait for the deployment to serve this build")
    parser.add_argument("--interval", type=float, default=10.0, help="seconds between polls")
    parser.add_argument("--verbose", action="store_true", help="show every poll, not just the first")
    args = parser.parse_args(argv)

    if not args.expected_bundle:
        parser.error(
            "--expected-bundle is required (build the frontend first and read it out "
            "of dist/index.html); without it the check would compare the deployment "
            "to itself and pass while serving an old build"
        )

    api_paths = args.api_paths or [
        os.environ.get("POST_DEPLOY_API_PATH", DEFAULT_API_PATH)
    ]

    try:
        return run(args.url, args.expected_bundle, api_paths, args.timeout, args.interval,
                   args.verbose, args.demo_email, args.demo_password, args.min_rows)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
