"""Refresh-token flow: short access tokens, rotation, and reuse detection.

The contract under test:
  * login/register deliver the refresh token in an httpOnly cookie scoped to
    /api/auth (never in the response body);
  * POST /api/auth/refresh rotates it — the presented token is burned and a
    replacement issued in the same family;
  * replaying a rotated token outside the multi-tab grace window revokes the
    whole family (the theft response), while replaying inside the window is
    tolerated so concurrent tabs don't log the user out;
  * expiry, logout, and password changes all kill outstanding refresh tokens;
  * the shipped default access-token lifetime is 3 hours, not 12.
"""
import datetime as dt
import os
import subprocess
import sys

import pytest

from app import models
from app.core import security
from app.database import SessionLocal
from app.routers.auth import REFRESH_COOKIE, REFRESH_REUSE_GRACE_SECONDS, _hash_refresh_token

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(autouse=True)
def _seeded(seeded_business):
    """These tests log in as the seeded owner — make sure it exists first
    (otherwise the fixture is only created as a side effect of other files)."""
    return seeded_business


@pytest.fixture(autouse=True)
def _clean_cookie_jar(client):
    """The session-scoped TestClient shares one cookie jar across the suite.

    Start each test from a known state, and leave none behind: a leaked
    marketmind_session cookie would silently authenticate later
    "requires no credentials" tests in other files.
    """
    client.cookies.clear()
    yield
    client.cookies.clear()


def _login(client, email="owner@test.com", password="Owner@123"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res


def _raw_refresh(res):
    """Extract the raw refresh token from a login/refresh response."""
    raw = res.cookies.get(REFRESH_COOKIE)
    assert raw, f"no {REFRESH_COOKIE} cookie in response: {res.headers.get_list('set-cookie')}"
    return raw


def _refresh_as(raw, client):
    """POST /api/auth/refresh with ONLY the given refresh token attached.

    The jar is cleared first so httpx passes the explicit Cookie header
    through untouched (an empty jar merges nothing over it). Lets a test
    replay an old, already-rotated token without fighting the shared jar.
    """
    client.cookies.clear()
    return client.post(
        "/api/auth/refresh",
        headers={"Cookie": f"{REFRESH_COOKIE}={raw}"},
    )


def _mutate_token_row(raw, **attrs):
    """Apply attribute updates to the refresh_tokens row for a raw token."""
    db = SessionLocal()
    try:
        row = (
            db.query(models.RefreshToken)
            .filter(models.RefreshToken.token_hash == _hash_refresh_token(raw))
            .first()
        )
        assert row is not None, "refresh token row not found"
        for key, value in attrs.items():
            setattr(row, key, value)
        db.commit()
    finally:
        db.close()


def _token_row(raw):
    db = SessionLocal()
    try:
        return (
            db.query(models.RefreshToken)
            .filter(models.RefreshToken.token_hash == _hash_refresh_token(raw))
            .first()
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Delivery: where the refresh token lives
# ---------------------------------------------------------------------------


def test_login_sets_httponly_refresh_cookie_scoped_to_auth(client):
    res = _login(client)
    entries = [h for h in res.headers.get_list("set-cookie") if h.startswith(f"{REFRESH_COOKIE}=")]
    assert len(entries) == 1, entries
    cookie = entries[0]
    assert "HttpOnly" in cookie
    assert "Path=/api/auth" in cookie
    assert "SameSite=lax" in cookie
    # Delivered in the cookie only — never echoed where page JS could read it.
    assert REFRESH_COOKIE not in res.text
    assert "refresh_token" not in res.json()


def test_register_also_issues_a_refresh_cookie(client):
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Refresh Fan",
            "email": "refreshfan@test.com",
            "password": "Refresh@123",
            "role": "business_owner",
            "join_mode": "create",
            "company_name": "Refresh Co",
        },
    )
    assert res.status_code == 201, res.text
    assert _raw_refresh(res)


# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------


def test_refresh_rotates_the_token_and_returns_a_new_access_token(client):
    first = _login(client)
    old_raw = _raw_refresh(first)

    res = client.post("/api/auth/refresh")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"]
    assert body["access_token"] != first.json()["access_token"]

    new_raw = _raw_refresh(res)
    assert new_raw != old_raw, "refresh token must rotate on every use"

    # The old row is burned; the new one is live, same family.
    old_row, new_row = _token_row(old_raw), _token_row(new_raw)
    assert old_row.revoked is True and old_row.used_at is not None
    assert new_row.revoked is not True
    assert new_row.family_id == old_row.family_id
    assert new_row.user_id == old_row.user_id

    # The freshly minted access token is accepted (cookie path AND bearer path).
    assert client.get("/api/auth/me").status_code == 200
    bearer = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/auth/me", headers=bearer).status_code == 200


def test_refresh_without_a_cookie_is_rejected(client):
    assert client.post("/api/auth/refresh").status_code == 401


def test_refresh_with_a_forged_token_is_rejected(client):
    _login(client)
    client.cookies.clear()
    res = client.post(
        "/api/auth/refresh",
        headers={"Cookie": f"{REFRESH_COOKIE}={'A' * 64}"},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Reuse detection
# ---------------------------------------------------------------------------


def test_replay_inside_grace_window_is_a_multi_tab_race_not_theft(client):
    first = _login(client)
    old_raw = _raw_refresh(first)

    res = client.post("/api/auth/refresh")
    assert res.status_code == 200

    # Second tab replays the just-rotated token moments later: tolerated, and
    # it rotates again rather than killing the session.
    replay = _refresh_as(old_raw, client)
    assert replay.status_code == 200, replay.text
    assert _raw_refresh(replay) != old_raw
    # The burned row still exists and the family is still usable afterwards.
    assert _token_row(old_raw) is not None
    follow = client.post("/api/auth/refresh")
    assert follow.status_code == 200, follow.text


def test_replay_after_the_grace_window_revokes_the_whole_family(client):
    first = _login(client)
    old_raw = _raw_refresh(first)

    rotated = client.post("/api/auth/refresh")
    assert rotated.status_code == 200
    newest_raw = _raw_refresh(rotated)

    # Push the rotation outside the grace window: this is now an old token
    # coming back, which is the classic stolen-refresh-token signal.
    _mutate_token_row(
        old_raw,
        used_at=dt.datetime.utcnow()
        - dt.timedelta(seconds=REFRESH_REUSE_GRACE_SECONDS + 30),
    )

    replay = _refresh_as(old_raw, client)
    assert replay.status_code == 401
    assert "revoked" in replay.json()["detail"].lower()

    # Every token in the family dies — including the newest one, so the thief
    # cannot keep using the successor they may already hold.
    assert _token_row(newest_raw).revoked is True
    assert _refresh_as(newest_raw, client).status_code == 401


def test_expired_refresh_token_is_rejected(client):
    first = _login(client)
    raw = _raw_refresh(first)
    _mutate_token_row(raw, expires_at=dt.datetime.utcnow() - dt.timedelta(seconds=1))

    res = _refresh_as(raw, client)
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_deactivated_user_cannot_refresh(client):
    first = _login(client)
    raw = _raw_refresh(first)
    _mutate_token_row(raw, revoked=False, used_at=None)  # keep it valid
    db = SessionLocal()
    try:
        row = _token_row(raw)
        user = db.query(models.User).filter(models.User.id == row.user_id).first()
        user.is_active = False
        db.commit()
    finally:
        db.close()
    try:
        res = _refresh_as(raw, client)
        assert res.status_code == 401
    finally:
        db = SessionLocal()
        try:
            user = db.query(models.User).filter(models.User.id == row.user_id).first()
            user.is_active = True
            db.commit()
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Revocation on logout / password change
# ---------------------------------------------------------------------------


def test_logout_revokes_the_refresh_token(client):
    first = _login(client)
    raw = _raw_refresh(first)

    out = client.post("/api/auth/logout")
    assert out.status_code == 200
    assert _token_row(raw).revoked is True

    replay = _refresh_as(raw, client)
    assert replay.status_code == 401


def test_password_change_revokes_prior_refresh_sessions(client):
    first = _login(client)
    raw = _raw_refresh(first)

    res = client.put(
        "/api/auth/change-password",
        json={"current_password": "Owner@123", "new_password": "Owner@123"},
    )
    assert res.status_code == 200, res.text

    # Old token is dead, but THIS browser was re-issued a working one so
    # securing the account does not log the user out.
    assert _token_row(raw).revoked is True
    new_raw = res.cookies.get(REFRESH_COOKIE)
    assert new_raw and new_raw != raw
    assert _token_row(new_raw).revoked is not True
    follow = client.post("/api/auth/refresh")
    assert follow.status_code == 200, follow.text


# ---------------------------------------------------------------------------
# Access-token lifetime
# ---------------------------------------------------------------------------


def test_access_token_expiry_follows_configuration():
    """The access token's exp claim honours ACCESS_TOKEN_EXPIRE_MINUTES."""
    token = security.create_access_token({"sub": "1", "role": "admin"})
    from jose import jwt

    claims = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    delta = claims["exp"] - claims["iat"]
    assert delta == security.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def test_default_access_token_expiry_is_three_hours():
    """The shipped default is 3h — a fresh process with no env override."""
    env = {k: v for k, v in os.environ.items() if k not in (
        "ACCESS_TOKEN_EXPIRE_MINUTES", "ENVIRONMENT", "APP_ENV",
    )}
    out = subprocess.run(
        [sys.executable, "-c",
         "from app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES; print(ACCESS_TOKEN_EXPIRE_MINUTES)"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120,
    )
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "180", out.stdout


def test_default_refresh_token_expiry_is_configurable():
    assert security.REFRESH_TOKEN_EXPIRE_DAYS >= 1
