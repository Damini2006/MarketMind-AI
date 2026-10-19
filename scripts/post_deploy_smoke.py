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

Per-role access matrix: every role loads exactly its pages, and no more
----------------------------------------------------------------------------
The checks above are anonymous, which is most of what a deploy can get wrong.
The rest is the app working for the roles that are allowed in, and NOT working
for the roles that are not: a 401, a 403 or an empty payload still paints a page
that looks like it loaded, so all three fail silently.

This logs in as one account per role and asserts that role's row of a matrix
built from the two places that must agree:

  * the nav gate — ``ROLE_PAGES`` in ``frontend/src/components/Layout.jsx``,
  * the enforcement — ``require_roles`` in ``backend/app/routers/*.py``.

For every page a role is granted, the data that page's own fetch reads must
really load (a listed payload with rows, or a JSON payload for the analysis
endpoints). For every page it is NOT granted, the check asserts the API refuses
it with 403 — but only where the backend enforces that gate at all. The read
endpoints behind the pages listed in FRONTEND_ONLY_PAGES accept any authenticated
user, so those pages are gated by the menu alone and no 403 is asserted for them;
the run names them out loud (``::notice::``) rather than implying a guarantee the
backend never made. Which pages those are is not a judgement call: a page is
frontend-gated only when none of the paths behind it is role-guarded, and the
checker that keeps this file honest with the routers asserts exactly that.

Writes are part of the row too, because that is where the roles mostly differ.
Each write is probed with an EMPTY JSON body: the role guard runs before body
validation, so a refused role gets 403 and an allowed one gets 422, and neither
can create, update or delete a row. That is what makes this safe to run against
production on a schedule — and it keeps the old "the credential really is
unprivileged" assertion, generalised to every role.

An account that logs in with a role other than the one its slot names is a
FAILURE, not an adaptation: the slot declares which expectations apply, so a
second owner sitting in the store_manager slot would be judged by the wrong row.

Credentials come from repository secrets, one slot per role, and are never
defaulted in this file:

    business_owner   POST_DEPLOY_OWNER_EMAIL / _PASSWORD
    store_manager    POST_DEPLOY_STORE_MANAGER_EMAIL / _PASSWORD
    sales_executive  POST_DEPLOY_SALES_EXECUTIVE_EMAIL / _PASSWORD
    admin            POST_DEPLOY_ADMIN_EMAIL / _PASSWORD

``POST_DEPLOY_DEMO_EMAIL`` / ``_PASSWORD`` is still honoured as the
sales_executive slot, because that is what production already has wired.

A role with neither variable set is SKIPPED with a ``::warning::`` annotation —
never counted as a pass — so a half-configured deployment reports what it did
not check. Setting one of the pair without the other IS a failure, because that
is a misconfigured secret rather than an absent one. In production the demo
accounts are not seeded (``ENVIRONMENT=production`` turns seeding off), so these
must be real accounts, each on a tenant with data.

``--require-roles a,b`` fails the run when a named role has no credentials. The
scheduled daily run names the roles it has wired: a schedule exists to prove the
checks still work, so a row that quietly vanished for want of a secret would
leave it green and empty.

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

Retired hostnames must redirect, not answer
-------------------------------------------
The canonical host can be healthy while an old ``*.vercel.app`` alias still
resolves and serves a build from a different commit. ``frontend/vercel.json``
declares the retired hostnames and where they must send readers; this gate
probes each one and fails when it answers 200 with a page instead of a 3xx to
the canonical origin, or when the 3xx lands anywhere else. A pinned alias
serving a stale bundle looks alive from the outside, which is exactly why it is
probed here rather than assumed.

Configuration (flags override environment, environment overrides defaults)
-------------------------------------------------------------------------
    --url              / POST_DEPLOY_URL             default the production site
    --expected-bundle  / POST_DEPLOY_EXPECTED_BUNDLE required, no default
    --api-path         / POST_DEPLOY_API_PATH        default /api/sales/
                                                     (repeatable)
    --retired-hosts-file / POST_DEPLOY_RETIRED_HOSTS_FILE
                                                     default
                                                     frontend/vercel.json
    --credentials-file                               JSON mapping role ->
                                                     {email, password}; overrides
                                                     the environment without
                                                     putting a password on the
                                                     command line
    --require-roles                                  comma-separated roles that
                                                     must have credentials: a
                                                     named role with none fails
                                                     the run instead of skipping
    --demo-email       / POST_DEPLOY_DEMO_EMAIL      the sales_executive slot
    --demo-password    / POST_DEPLOY_DEMO_PASSWORD   the sales_executive slot
    --min-rows                                       default 1: rows each page
                                                     data path must return
    --timeout                                        default 420s
    --interval                                       default 10s

Exits 0 only when every check passes. Each failure is printed as a
``::error::`` line so it surfaces as an annotation on the GitHub Actions run
instead of hiding in the log.
"""
from __future__ import annotations

from collections import namedtuple

import argparse
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

DEFAULT_URL = "https://frontend-xi-ashy-73.vercel.app"
DEFAULT_API_PATH = "/api/sales/"
USER_AGENT = "marketmind-post-deploy-smoke/1.0"
ENTRY_BUNDLE_RE = re.compile(r'src="(/assets/[^"]+\.js)"')

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_RETIRED_HOSTS_FILE = os.path.join(REPO_ROOT, "frontend", "vercel.json")


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}"


def _rel(path: str) -> str:
    """A repo-relative path for messages, without raising for an outside path."""
    try:
        return os.path.relpath(path, REPO_ROOT)
    except ValueError:
        return path

# ── the per-role access matrix ──────────────────────────────────────
# Who may open which page, and what that has to mean at the API level.
#
# ``roles`` mirrors the frontend's ROLE_PAGES map (components/Layout.jsx) - the
# menu and route gate. ``rows`` and ``json_ok`` are the paths the page's own
# fetch reads: a granted page whose data will not load is a failure, not a pass,
# because a 401, a 403 or an empty payload all still paint a page.
#
# ``denied`` is populated ONLY where the backend enforces the same gate
# (require_roles in app/routers/*.py). There a role outside ``roles`` must be
# refused with 403, which is the half of this matrix the API can actually prove.
# Pages whose endpoints accept any authenticated user are frontend-gated only:
# no 403 is asserted for them, and the run says so (see FRONTEND_ONLY_PAGES).
ALL_ROLES = ("business_owner", "store_manager", "sales_executive", "admin")
OWNER_MANAGER_ADMIN = ("business_owner", "store_manager", "admin")
OWNER_ADMIN = ("business_owner", "admin")

PageAccess = namedtuple("PageAccess", "path label roles rows json_ok denied", defaults=((), (), ()))

PAGE_MATRIX = (
    # Compare Periods computes in the browser from three list endpoints that any
    # authenticated user may read, so the menu is its only gate.
    PageAccess(
        "/comparison", "Compare Periods", ("business_owner", "store_manager", "admin"),
        rows=("/api/sales/", "/api/invoices/", "/api/inventory/products"),
    ),
    # Funnel Analysis reads the same three; the menu grants it to owner and admin
    # but not to store_manager, and the API does not enforce that either.
    PageAccess(
        "/funnel", "Funnel Analysis", ("business_owner", "admin"),
        rows=("/api/customers/", "/api/sales/", "/api/inventory/products"),
    ),
    PageAccess(
        "/forecasting", "Forecasting", OWNER_MANAGER_ADMIN,
        json_ok=("/api/ai/forecast",), denied=("/api/ai/forecast",),
    ),
    PageAccess(
        "/churn", "Churn", OWNER_MANAGER_ADMIN,
        json_ok=("/api/ai/churn",), denied=("/api/ai/churn",),
    ),
    PageAccess(
        "/anomalies", "Anomalies", OWNER_MANAGER_ADMIN,
        json_ok=("/api/ai/anomalies",), denied=("/api/ai/anomalies",),
    ),
    # Categories and Suppliers are gated by the menu alone: categories.py and
    # suppliers.py guard POST and DELETE with require_roles, but their LIST
    # endpoints are get_current_user, so any signed-in role can read the data.
    # Only the write is enforced, and that is asserted in WRITE_GUARDS instead.
    PageAccess(
        "/categories", "Categories", OWNER_MANAGER_ADMIN,
        rows=("/api/categories/",),
    ),
    PageAccess(
        "/suppliers", "Suppliers", OWNER_MANAGER_ADMIN,
        rows=("/api/suppliers/",),
    ),
    # Activity reads /api/audit/logs (open) and /api/system/cache-stats, which is
    # where its owner/manager/admin gate is actually enforced.
    PageAccess(
        "/activity", "Activity", OWNER_MANAGER_ADMIN,
        json_ok=("/api/audit/logs",), denied=("/api/system/cache-stats",),
    ),
    # Team is the page whose own list endpoint is guarded, so both directions are
    # provable: owner and admin read it, store_manager and sales_executive get 403.
    PageAccess(
        "/team", "Team", OWNER_ADMIN,
        rows=("/api/users/",), denied=("/api/users/",),
    ),
)

# Pages the menu gates but the API does not, reported once per run so that "no
# failures" is not read as "the API refuses those roles too".
FRONTEND_ONLY_PAGES = tuple(p for p in PAGE_MATRIX if not p.denied)

WriteGuard = namedtuple("WriteGuard", "action method path roles")

# Each write is probed with an EMPTY JSON body. The role guard runs before body
# validation, so a refused role gets 403 while an allowed one gets 422 - and
# neither can create anything. Nothing here is a DELETE, and nothing here can
# mutate a row with an empty body.
WRITE_GUARDS = (
    WriteGuard("add a product", "POST", "/api/inventory/products", OWNER_MANAGER_ADMIN),
    WriteGuard("add a customer", "POST", "/api/customers/",
               ("business_owner", "sales_executive", "admin")),
    WriteGuard("raise an invoice", "POST", "/api/invoices/",
               ("business_owner", "sales_executive", "admin")),
    WriteGuard("add a category", "POST", "/api/categories/", OWNER_MANAGER_ADMIN),
    WriteGuard("add a supplier", "POST", "/api/suppliers/", OWNER_MANAGER_ADMIN),
    WriteGuard("invite a teammate", "POST", "/api/users/", OWNER_ADMIN),
)

# One account per role, from repository secrets. The original single-account
# slot (POST_DEPLOY_DEMO_*) stays valid as the sales_executive one: it is what
# production has wired, so renaming it would only invite breakage.
ROLE_CREDENTIALS = {
    "business_owner": ("POST_DEPLOY_OWNER_EMAIL", "POST_DEPLOY_OWNER_PASSWORD"),
    "store_manager": ("POST_DEPLOY_STORE_MANAGER_EMAIL", "POST_DEPLOY_STORE_MANAGER_PASSWORD"),
    "sales_executive": ("POST_DEPLOY_SALES_EXECUTIVE_EMAIL",
                        "POST_DEPLOY_SALES_EXECUTIVE_PASSWORD"),
    "admin": ("POST_DEPLOY_ADMIN_EMAIL", "POST_DEPLOY_ADMIN_PASSWORD"),
}
ROLE_CREDENTIAL_FALLBACKS = {
    "sales_executive": ("POST_DEPLOY_DEMO_EMAIL", "POST_DEPLOY_DEMO_PASSWORD"),
}

# A list payload is either a bare array or one of these keys. This mirrors the
# frontend's toList() helper, deliberately: a payload that helper would render as
# an empty page must not be accepted here as "fine".
ROWS_KEYS = ("items", "data", "results", "rows")

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


def probe_redirect(url: str, timeout: float = 20.0):
    """GET `url` without following redirects: (status, location, error).

    Following the redirect would hide the thing this check exists to see - that
    the retired host issued one at all. A raw connection reports the first
    response verbatim, so a 3xx stays a 3xx and a stale 200 stays a 200.
    """
    parts = urlsplit(url)
    conn = http.client.HTTPSConnection(parts.netloc, timeout=timeout)
    path = parts.path or "/"
    if parts.query:
        path = f"{path}?{parts.query}"
    try:
        conn.request("GET", path, headers={"User-Agent": USER_AGENT})
        resp = conn.getresponse()
        return resp.status, (resp.getheader("Location") or ""), None
    except Exception as exc:  # noqa: BLE001 - DNS, TLS and timeouts all mean "unreachable"
        return None, "", f"{type(exc).__name__}: {exc}"
    finally:
        try:
            conn.close()
        except Exception:
            pass


def retired_hosts_from(path: str):
    """(host, destination) pairs the hosting config redirects away from."""
    try:
        with open(path, encoding="utf-8") as fh:
            config = json.load(fh)
    except (OSError, ValueError) as exc:
        raise ValueError(f"{path}: {exc}") from exc
    pairs = []
    for rule in config.get("redirects") or []:
        destination = rule.get("destination", "")
        for entry in rule.get("has") or []:
            if entry.get("type") == "host" and entry.get("value"):
                pairs.append((entry["value"], destination))
    return pairs


def check_retired_hosts(canonical_url: str, hosts_file: str, report: Report) -> None:
    """Every retired hostname must 3xx to the canonical origin, never serve a build.

    A retired Vercel alias is pinned to one deployment. If it was never
    repointed after the redirect rule shipped, it answers 200 with an old bundle
    and looks healthy while serving a build from a different commit - the exact
    two-day-old stale-host incident this gate exists for. So here a 2xx is a
    FAILURE, not a pass: the host is retired and must not answer at all.
    """
    canonical = _origin(canonical_url)
    name_base = "retired hostnames redirect to the canonical origin"
    try:
        hosts = retired_hosts_from(hosts_file)
    except ValueError as exc:
        report.fail(name_base, f"cannot read the redirect rules: {exc}")
        return
    if not hosts:
        report.fail(
            name_base,
            f"{_rel(hosts_file)} declares no host redirects, so there is nothing to probe. "
            "Add the retired-host redirect rules (DEPLOY.md) or this check is vacuous.",
        )
        return
    for host, destination in hosts:
        name = f"retired host {host} redirects to {canonical}"
        status, location, error = probe_redirect(f"https://{host}/")
        if error is not None:
            report.fail(name, f"unreachable ({error})")
            continue
        if status is not None and 300 <= status < 400:
            origin = _origin(location) if location else ""
            if origin == canonical:
                report.ok(name, f"HTTP {status} -> {location}")
            else:
                report.fail(
                    name,
                    f"HTTP {status} -> {location or '<no Location header>'}, expected a redirect "
                    f"to {canonical}. {host} is retired, so it must not answer anywhere else "
                    f"(its rule in {_rel(hosts_file)} points at "
                    f"{destination or '<no destination>'}).",
                )
            continue
        if status is not None and 200 <= status < 300:
            report.fail(
                name,
                f"HTTP {status} served a page instead of redirecting to {canonical}: this alias "
                f"is pinned to a deployment that predates the redirect rule, so it is serving a "
                f"stale build on a retired hostname. Repoint it at the current production "
                f"deployment (vercel alias set <newest-production-deployment> {host}) - see "
                f"DEPLOY.md.",
            )
            continue
        report.fail(name, f"HTTP {status}: expected a 3xx redirect to {canonical}")


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


def role_credentials(overrides=None):
    """(role -> (email, password) | None), from the environment and overrides."""
    overrides = overrides or {}
    resolved = {}
    for role, (email_var, password_var) in ROLE_CREDENTIALS.items():
        pair = overrides.get(role) or {}
        email = pair.get("email") or os.environ.get(email_var)
        password = pair.get("password") or os.environ.get(password_var)
        if not email and not password:
            fallback = ROLE_CREDENTIAL_FALLBACKS.get(role)
            if fallback:
                email = os.environ.get(fallback[0])
                password = os.environ.get(fallback[1])
        resolved[role] = (email, password) if (email or password) else None
    return resolved


def role_check_names(role):
    """Every check name this role's row reports, in the order it reports them."""
    names = []
    for page in PAGE_MATRIX:
        if role in page.roles:
            names += [f"{role} | {page.label} ({page.path}): {p} returns rows" for p in page.rows]
            names += [f"{role} | {page.label} ({page.path}): {p} answers" for p in page.json_ok]
        else:
            names += [f"{role} | {page.label} ({page.path}) is refused: {p}" for p in page.denied]
    for guard in WRITE_GUARDS:
        if role in guard.roles:
            names.append(f"{role} | {guard.action} is allowed: {guard.method} {guard.path}")
        else:
            names.append(f"{role} | {guard.action} is refused: {guard.method} {guard.path}")
    return names


def report_rows(name, res, report, min_rows):
    """A page's list payload must really carry rows."""
    if res.status is None:
        report.fail(name, res.describe())
        return
    if res.status in (401, 403):
        report.fail(
            name,
            f"{res.describe()}: this role cannot read this path, so its page would "
            f"render empty for that role",
        )
        return
    if not (200 <= res.status < 300):
        report.fail(name, f"{res.describe()}: {res.text[:160]!r}")
        return
    payload = res.json
    if payload is None:
        report.fail(
            name,
            f"{res.describe()}: body is not JSON, so the page's fetch would throw. "
            f"First bytes: {res.text[:120]!r}",
        )
        return
    rows = list_rows(payload)
    if rows is None:
        report.fail(
            name,
            f"{res.describe()}: payload is not a list or a list envelope "
            f"({sorted(ROWS_KEYS)}). First bytes: {res.text[:120]!r}",
        )
        return
    if len(rows) < min_rows:
        report.fail(
            name,
            f"{res.describe()}: {len(rows)} rows, expected at least {min_rows}. The page "
            "loads but has nothing to show - check that this account belongs to a tenant "
            "with data.",
        )
        return
    report.ok(name, f"{len(rows)} rows")


def report_json(name, res, label, report):
    """An analysis endpoint must answer this role with JSON, not a refusal."""
    if res.status is None:
        report.fail(name, res.describe())
        return
    if res.status in (401, 403):
        report.fail(
            name,
            f"{res.describe()}: this role is granted {label} by the menu but the API "
            f"refuses its data, so the page cannot work for it",
        )
        return
    if not (200 <= res.status < 300):
        report.fail(name, f"{res.describe()}: {res.text[:160]!r}")
        return
    if res.json is None:
        report.fail(
            name,
            f"{res.describe()}: body is not JSON; the page would throw. "
            f"First bytes: {res.text[:120]!r}",
        )
        return
    report.ok(name, res.describe())


def check_role_reads(url, role, token, report, min_rows):
    """Every page this role has, and every page it must be refused."""
    base = url.rstrip("/")
    for page in PAGE_MATRIX:
        if role in page.roles:
            for path in page.rows:
                name = f"{role} | {page.label} ({page.path}): {path} returns rows"
                report_rows(name, request(f"{base}{path}", token=token, timeout=60.0),
                            report, min_rows)
            for path in page.json_ok:
                name = f"{role} | {page.label} ({page.path}): {path} answers"
                report_json(name, request(f"{base}{path}", token=token, timeout=60.0),
                            page.label, report)
        else:
            for path in page.denied:
                name = f"{role} | {page.label} ({page.path}) is refused: {path}"
                res = request(f"{base}{path}", token=token, timeout=30.0)
                if res.status == 403:
                    report.ok(name, f"{res.describe()} (this role has no {page.path})")
                else:
                    report.fail(
                        name,
                        f"{res.describe()}: expected 403. {role} must not reach the data "
                        f"behind {page.path}, and a 2xx here means that gate is gone.",
                    )


def check_role_writes(url, role, token, report):
    """Every write this role may make, and every write it must be refused.

    The empty body is the point: a role guard runs before body validation, so an
    allowed role stops at 422 and nothing is written, while a refused role never
    gets that far. Both outcomes are asserted, so an over-restriction (a role
    refused something it should be allowed) fails just as loudly as a hole.
    """
    base = url.rstrip("/")
    for guard in WRITE_GUARDS:
        res = request(f"{base}{guard.path}", method=guard.method, payload={}, token=token,
                      timeout=30.0)
        why = "empty body on purpose, so an allowed role stops at validation and writes nothing"
        if role in guard.roles:
            name = f"{role} | {guard.action} is allowed: {guard.method} {guard.path}"
            if res.status == 403:
                report.fail(
                    name,
                    f"403: this role IS allowed to {guard.action}, so this is an "
                    f"over-restriction rather than a security win",
                )
            elif res.status is not None and 200 <= res.status < 300:
                report.fail(
                    name,
                    f"{res.describe()}: an empty body was ACCEPTED. This probe expected "
                    f"validation to refuse it and it may have written a row - check the "
                    f"tenant before re-running against production",
                )
            else:
                report.ok(name, f"{res.describe()} ({why})")
        else:
            name = f"{role} | {guard.action} is refused: {guard.method} {guard.path}"
            if res.status == 403:
                report.ok(name, f"{res.describe()}")
            else:
                report.fail(
                    name,
                    f"{res.describe()}: expected 403. {role} must not be able to {guard.action}, "
                    f"and a 2xx or a 422 means the role guard let it through to validation.",
                )


def check_role(url, role, email, password, report, verbose, min_rows):
    """One row of the matrix: log in as `role`, then assert exactly its access."""
    name = f"{role} | an account exists and can log in"
    token, actual, res = login(url, email, password, report, verbose)
    if not token:
        detail = res.describe()
        if res.status in (401, 403):
            detail += (" - either there is no account with this email in the deployment, or "
                       "the secret holds the wrong password")
        elif res.status == 429:
            detail += " (rate limited: 10 logins per IP per 300s)"
        report.fail(name, f"{email}: {detail}")
        for skipped in role_check_names(role):
            report.skip(skipped, "no session for this role")
        return
    if actual != role:
        report.fail(
            f"{role} | the account really has the {role} role",
            f"{email} logged in as '{actual}'. Each slot declares which expectations apply, "
            f"so another role's account here would be judged by the wrong row - use an "
            f"account whose role is {role}.",
        )
        for skipped in role_check_names(role):
            report.skip(skipped, f"the account in this slot has role '{actual}'")
        return
    report.ok(name, f"{email}, role={actual}")
    check_role_reads(url, role, token, report, min_rows)
    check_role_writes(url, role, token, report)


def run(url: str, expected: str, api_paths: list[str], timeout: float, interval: float,
        verbose: bool, credentials: dict = None, min_rows: int = 1,
        require_roles: tuple = (), retired_hosts_file: str = DEFAULT_RETIRED_HOSTS_FILE) -> int:
    report = Report()
    print(f"Post-deploy smoke check against {url}")
    print(f"  this build's entry bundle: {expected}")
    print()

    wait_for_bundle(url, expected, timeout, interval, report, verbose)
    check_entry_asset(url, expected, report)
    for api_path in api_paths:
        check_api(url, api_path, report)

    # The canonical host can be perfect while a retired alias still serves an old
    # build, so the old names are probed too.
    print()
    check_retired_hosts(url, retired_hosts_file, report)

    # ── the per-role access matrix ────────────────────────────────────────
    print()
    print(f"Per-role access matrix: {len(PAGE_MATRIX)} pages, {len(WRITE_GUARDS)} guarded writes "
          f"x {len(ALL_ROLES)} roles")
    credentials = credentials or {}
    if not any(credentials.values()):
        advice = ("no credentials for any role: set POST_DEPLOY_<ROLE>_EMAIL and "
                  "POST_DEPLOY_<ROLE>_PASSWORD (repository secrets) to run the matrix")
        if require_roles:
            report.fail(
                "the per-role matrix has credentials",
                f"--require-roles {'/'.join(require_roles)} was requested, but {advice}",
            )
        else:
            report.skip("authenticated checks (the per-role matrix)", advice)
    else:
        for role in ALL_ROLES:
            email_var, password_var = ROLE_CREDENTIALS[role]
            pair = credentials.get(role)
            if pair is None:
                if role in require_roles:
                    report.fail(
                        f"{role} | credentials are configured for this role",
                        f"--require-roles names {role}, so this run may not skip it. Set "
                        f"{email_var} and {password_var}.",
                    )
                else:
                    report.skip(
                        f"{role} | the whole row",
                        f"no credentials: set {email_var} and {password_var}, then list the "
                        f"role in --require-roles so a run that cannot check it stops passing",
                    )
                continue
            email, password = pair
            if not (email and password):
                report.fail(
                    f"{role} | credentials are complete",
                    f"only one of {email_var} and {password_var} is set. Set both "
                    f"(repository secrets) or neither.",
                )
                continue
            check_role(url, role, email, password, report, verbose, min_rows)

    if FRONTEND_ONLY_PAGES:
        listed = ", ".join(f"{p.path} ({p.label})" for p in FRONTEND_ONLY_PAGES)
        print()
        print(f"  note: the API serves these pages to any signed-in user, so the menu is their "
              f"only gate and no 403 is asserted for them: {listed}")
        print(f"::notice title=post-deploy smoke: pages the API does not gate::{listed}")

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
    parser.add_argument("--retired-hosts-file",
                        default=os.environ.get("POST_DEPLOY_RETIRED_HOSTS_FILE",
                                               DEFAULT_RETIRED_HOSTS_FILE),
                        help="hosting config whose redirect rules name the retired hostnames to "
                             "probe; each must 3xx to the canonical origin, not serve a build")
    parser.add_argument("--demo-email",
                        default=os.environ.get("POST_DEPLOY_DEMO_EMAIL"),
                        help="read-only demo account; unset skips the authenticated checks")
    parser.add_argument("--demo-password",
                        default=os.environ.get("POST_DEPLOY_DEMO_PASSWORD"),
                        help="demo account password (prefer the secret/env over this flag)")
    parser.add_argument("--credentials-file",
                        default=os.environ.get("POST_DEPLOY_CREDENTIALS_FILE"),
                        help="JSON mapping role -> {email, password}; overrides the environment "
                             "without putting a password in the command line")
    parser.add_argument("--require-roles",
                        default=os.environ.get("POST_DEPLOY_REQUIRE_ROLES"),
                        help="comma-separated roles that must have credentials: a named role "
                             "with none fails the run instead of being skipped")
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

    overrides = {}
    if args.demo_email or args.demo_password:
        overrides["sales_executive"] = {"email": args.demo_email, "password": args.demo_password}
    if args.credentials_file:
        try:
            with open(args.credentials_file, encoding="utf-8") as fh:
                loaded = json.load(fh)
        except (OSError, ValueError) as exc:
            parser.error(f"--credentials-file {args.credentials_file}: {exc}")
        if not isinstance(loaded, dict):
            parser.error("--credentials-file must hold a JSON object keyed by role")
        for role, pair in loaded.items():
            if role not in ROLE_CREDENTIALS:
                parser.error(f"--credentials-file names an unknown role {role!r}; known roles "
                             f"are {', '.join(ROLE_CREDENTIALS)}")
            if not isinstance(pair, dict) or not pair.get("email") or not pair.get("password"):
                parser.error(f"--credentials-file: {role} needs both an email and a password")
            overrides[role] = pair

    require_roles = tuple(r.strip() for r in (args.require_roles or "").split(",") if r.strip())
    for role in require_roles:
        if role not in ROLE_CREDENTIALS:
            parser.error(f"--require-roles names an unknown role {role!r}; known roles are "
                         f"{', '.join(ROLE_CREDENTIALS)}")

    try:
        return run(args.url, args.expected_bundle, api_paths, args.timeout, args.interval,
                   args.verbose, role_credentials(overrides), args.min_rows, require_roles,
                   args.retired_hosts_file)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
