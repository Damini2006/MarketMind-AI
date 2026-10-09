#!/usr/bin/env python3
"""
MarketMind session keep-alive / refresh token watchdog.

Hits POST /api/auth/refresh every REFRESH_TOKEN_EXPIRE_DAYS/2 so that:
  - Sessions stay alive without the user needing to revisit the app.
  - Stale or revoked refresh tokens are detected early (a 401 here means the
    stored token was already rotated by a thief, and the watchdog can trigger
    an alert / forced re-login).

The refresh token is httpOnly and path-scoped to /api/auth, so a server-side
cron cannot read it from the browser. This script therefore authenticates once
with the 계정으로 credentials, stores the resulting refresh cookie in a local
file, and replays it on every subsequent run. On success it persists the new
cookie the server issued. On 401 it leaves the file in place so a follow-up
run can log the failure without re-authenticating.

Configuration (env vars, with defaults matching a local stack):
    MARKETMIND_BACKEND_URL  backend base URL (default http://localhost:8000)
    MARKETMIND_EMAIL        account to authenticate as
    MARKETMIND_PASSWORD     account password
    MARKETMIND_REFRESH_HALF_DAYS  run interval in days = REFRESH_TOKEN_EXPIRE_DAYS/2
                                   (default 15; override to match your 실제 expiry)
    MARKETMIND_COOKIE_FILE  path to the refresh-cookie store (default see below)

The cookie file is a JSON object: {"refresh": "<raw refresh token>"}. It is
created by the login step and rewritten on every successful refresh. It is NOT
a secret in the project sense (it is a credential for a specific account), so
it is gitignored and should live outside the repo on the machine that runs the
cron job.

Exit codes:
    0  refresh succeeded (cookie updated)
    1  refresh failed (401 or network error) — send the failure somewhere
    2  could not even log in (wrong credentials / backend unreachable)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BACKEND = os.getenv("MARKETMIND_BACKEND_URL", "http://localhost:8000").rstrip("/")
EMAIL = os.getenv("MARKETMIND_EMAIL")
PASSWORD = os.getenv("MARKETMIND_PASSWORD")
HALF_DAYS = int(os.getenv("MARKETMIND_REFRESH_HALF_DAYS", "15"))
COOKIE_FILE = Path(os.getenv(
    "MARKETMIND_COOKIE_FILE",
    str(Path(os.path.expanduser("~")) / ".marketmind" / "refresh_cookie.json"),
))

LOGIN_URL = f"{BACKEND}/api/auth/login"
REFRESH_URL = f"{BACKEND}/api/auth/refresh"


def _post(url, payload, headers, timeout=30.0):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.status


def _post_with_cookie(url, payload, cookie_value, timeout=30.0):
    headers = {
        "Accept": "application/json",
        "Cookie": f"marketmind_refresh={cookie_value}",
    }
    return _post(url, payload, headers, timeout)


def login():
    """Authenticate and return the raw refresh token from the Set-Cookie header."""
    payload = {"email": EMAIL, "password": PASSWORD}
    headers = {"Accept": "application/json"}
    try:
        body, status = _post(LOGIN_URL, payload, headers)
    except urllib.error.HTTPError as exc:
        print(f"login failed: HTTP {exc.code} {exc.reason}", file=sys.stderr)
        return None
    except Exception as exc:
        print(f"login failed: {exc}", file=sys.stderr)
        return None

    if status != 200:
        print(f"login returned status {status}", file=sys.stderr)
        return None

    # The refresh cookie is httpOnly — the body doesn't contain it, but the
    # Set-Cookie header does. urllib exposes it on the response object.
    # Re-issue the request through a tiny adapter that exposes headers.
    req = urllib.request.Request(
        LOGIN_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            cookies = resp.headers.get_all("Set-Cookie") or []
    except Exception as exc:
        print(f"could not read Set-Cookie: {exc}", file=sys.stderr)
        return None

    refresh = None
    for c in cookies:
        if c.startswith("marketmind_refresh="):
            refresh = c.split(";", 1)[0].split("=", 1)[1]
            break

    if not refresh:
        print("login succeeded but no marketmind_refresh cookie in response", file=sys.stderr)
        return None
    return refresh


def save_cookie(raw):
    COOKIE_FILE.parent.mkdir(parents=True, exist_ok=True)
    COOKIE_FILE.write_text(json.dumps({"refresh": raw}, indent=2) + "\n")


def load_cookie():
    if not COOKIE_FILE.exists():
        return None
    try:
        data = json.loads(COOKIE_FILE.read_text())
        return data.get("refresh")
    except Exception:
        return None


def refresh(raw):
    """POST /api/auth/refresh with the stored refresh cookie. Returns (body, status)."""
    try:
        body, status = _post_with_cookie(REFRESH_URL, {}, raw)
        return body, status
    except urllib.error.HTTPError as exc:
        # 401 = the stored token was revoked/rotated (stale or stolen). Don't
        # overwrite the cookie file so a follow-up can log the persistent failure.
        return None, exc.code
    except Exception as exc:
        return None, -1


def main():
    if not EMAIL or not PASSWORD:
        print("MARKETMIND_EMAIL and MARKETMIND_PASSWORD must be set", file=sys.stderr)
        return 2

    raw = load_cookie()
    if raw:
        body, status = refresh(raw)
        if status == 200:
            # Server rotated the token; persist the new one it issued.
            new_raw = body.get("access_token")  # not the refresh — read from Set-Cookie
            # Re-read the new refresh cookie from a fresh response.
            req = urllib.request.Request(
                REFRESH_URL,
                data=b"{}",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Cookie": f"marketmind_refresh={raw}",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=30.0) as resp:
                    for c in resp.headers.get_all("Set-Cookie") or []:
                        if c.startswith("marketmind_refresh="):
                            new_raw = c.split(";", 1)[0].split("=", 1)[1]
                            save_cookie(new_raw)
                            break
            except Exception as exc:
                print(f"refresh 200 but could not read new cookie: {exc}", file=sys.stderr)
                return 1

            print("refresh OK")
            return 0

        if status == 401:
            print("refresh returned 401 — stored token is stale/revoked", file=sys.stderr)
            return 1

        print(f"refresh failed: HTTP {status}", file=sys.stderr)
        return 1

    # No stored cookie — log in first.
    raw = login()
    if not raw:
        return 2

    save_cookie(raw)

    # Immediately refresh to confirm the brand-new token works and grab the
    # server's rotated version.
    body, status = refresh(raw)
    if status != 200:
        print(f"initial refresh after login failed: HTTP {status}", file=sys.stderr)
        return 1

    req = urllib.request.Request(
        REFRESH_URL,
        data=b"{}",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Cookie": f"marketmind_refresh={raw}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            for c in resp.headers.get_all("Set-Cookie") or []:
                if c.startswith("marketmind_refresh="):
                    save_cookie(c.split(";", 1)[0].split("=", 1)[1])
                    break
    except Exception as exc:
        print(f"initial refresh OK but could not read new cookie: {exc}", file=sys.stderr)
        return 1

    print("logged in and initial refresh OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
