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

The bundle match is REQUIRED, never inferred from the live page
----------------------------------------------------------------
Inferring "the expected bundle" from the deployment would compare the
deployment to itself and pass while it serves an old build. Build first, then
compare:

    cd frontend && npm ci && npm run build
    python3 scripts/post_deploy_smoke.py \\
      --url https://frontend-xi-ashy-73.vercel.app \\
      --expected-bundle "$(grep -oE '/assets/index-[^\"]+\\.js' dist/index.html | head -1)"

Because a deployment takes a moment to be promoted after a push, the bundle
check polls until it matches or ``--timeout`` elapses, then fails with what it
actually saw.

Configuration (flags override environment, environment overrides defaults)
------------------------------------------------------------------------
    --url              / POST_DEPLOY_URL             default the production site
    --expected-bundle  / POST_DEPLOY_EXPECTED_BUNDLE required, no default
    --api-path         / POST_DEPLOY_API_PATH        default /api/sales/
                                                     (repeatable)
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

    def describe(self) -> str:
        if self.status is None:
            return f"unreachable ({self.error})"
        return f"HTTP {self.status} {self.content_type or '<no content-type>'}"


def request(url: str, timeout: float = 20.0) -> Response:
    """GET a URL without raising: a failure is a Response, not an exception."""
    req = urllib.request.Request(
        url, method="GET", headers={"User-Agent": USER_AGENT, "Accept": "*/*"}
    )
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

    def summary(self) -> int:
        print()
        if self.failures:
            print(f"{len(self.failures)} of {self.checked} checks FAILED:", file=sys.stderr)
            for name in self.failures:
                print(f"  - {name}", file=sys.stderr)
            return 1
        print(f"all {self.checked} checks passed")
        return 0


def split_content_type(raw: str) -> str:
    return (raw or "").split(";")[0].strip().lower()


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
    report.ok(name, f"{res.describe()} (401 = reachable and auth-gated)")


def run(url: str, expected: str, api_paths: list[str], timeout: float, interval: float,
        verbose: bool) -> int:
    report = Report()
    print(f"Post-deploy smoke check against {url}")
    print(f"  this build's entry bundle: {expected}")
    print()

    wait_for_bundle(url, expected, timeout, interval, report, verbose)
    check_entry_asset(url, expected, report)
    for api_path in api_paths:
        check_api(url, api_path, report)

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
                   args.verbose)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
