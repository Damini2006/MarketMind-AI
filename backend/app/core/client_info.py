"""Client context helpers — device parsing and best-effort IP geolocation.

Kept dependency-free (stdlib only) and fail-safe: any failure degrades to
"Unknown" so login and audit logging are never blocked.
"""

import json
import re
import urllib.request
from functools import lru_cache

_PRIVATE_IPS = {"127.0.0.1", "::1", "localhost", "0.0.0.0", "unknown", "none", ""}

_OS_PATTERNS = [
    (re.compile(r"windows", re.I), "Windows"),
    (re.compile(r"android", re.I), "Android"),
    (re.compile(r"iphone|ipad|ipod|ios", re.I), "iOS"),
    (re.compile(r"mac os|macintosh|macppc", re.I), "macOS"),
    (re.compile(r"linux|ubuntu|fedora|debian", re.I), "Linux"),
]

_BROWSER_PATTERNS = [
    (re.compile(r"edg/|edge/", re.I), "Edge"),
    (re.compile(r"opr/|opera|opera mini", re.I), "Opera"),
    (re.compile(r"chrome|chromium|crios", re.I), "Chrome"),
    (re.compile(r"firefox|fxios|seamonkey", re.I), "Firefox"),
    (re.compile(r"safari", re.I), "Safari"),
    (re.compile(r"curl|wget|python-requests|postman|insomnia", re.I), "API Client"),
]


def parse_device(user_agent):
    """Return a short human-readable device string, e.g. 'Chrome · Windows · Desktop'."""
    ua = (user_agent or "").strip()
    if not ua or ua.lower() in ("unknown", "-"):
        return "Unknown device"

    os_name = "Unknown OS"
    for pat, name in _OS_PATTERNS:
        if pat.search(ua):
            os_name = name
            break

    browser = "Browser"
    for pat, name in _BROWSER_PATTERNS:
        if pat.search(ua):
            browser = name
            break

    mobile = bool(re.search(r"mobile|android|iphone|ipad|tablet", ua, re.I))
    form = "Mobile" if mobile else "Desktop"

    # Cull the raw UA so we don't store megabytes of junk.
    return f"{browser} · {os_name} · {form}"


@lru_cache(maxsize=2048)
def geolocate(ip):
    """Best-effort (location, latitude, longitude) for an IP via ipwho.is.

    Cached per IP. Localhost/private ranges resolve instantly to
    ("Local", None, None). Any network failure returns
    ("Unknown", None, None) — never raises.
    """
    if not ip or ip in _PRIVATE_IPS:
        return "Local", None, None
    try:
        with urllib.request.urlopen(f"https://ipwho.is/{ip}", timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data.get("success"):
            return "Unknown", None, None
        parts = [
            p
            for p in (
                data.get("city"),
                data.get("region"),
                data.get("country"),
            )
            if p
        ]
        location = ", ".join(parts) if parts else "Unknown"
        return location, data.get("latitude"), data.get("longitude")
    except Exception:
        return "Unknown", None, None