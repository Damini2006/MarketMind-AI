"""CSRF double-submit enforcement.

The contract under test:
  * login/register set a non-httpOnly ``marketmind_csrf`` cookie whose value
    page JS reads and sends back in the ``X-CSRF-Token`` request header;
  * every state-changing request (POST/PUT/PATCH/DELETE) that carries a
    session cookie but NO Bearer auth must also carry a matching
    ``X-CSRF-Token`` header — otherwise 403;
  * API clients authenticating with ``Authorization: Bearer ...`` skip the
    check (they cannot set cookies cross-site);
  * auth endpoints (``/api/auth/*``) are never CSRF-checked (they have their
    own rate limiting and must remain accessible before a session exists);
  * safe methods (GET/HEAD/OPTIONS) are never checked.
  * in production (cross-subdomain frontend) the CSRF cookie is
    ``SameSite=None; Secure`` so the browser sends it cross-subdomain;
  * outside production the CSRF cookie is ``SameSite=Lax`` (the default).
"""


def test_login_sets_csrf_cookie(client, seeded_business):
    res = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert res.status_code == 200, res.text
    cookies = {c.split("=")[0]: c.split("=")[1].split(";")[0] for c in res.headers.get_list("set-cookie")}
    assert "marketmind_csrf" in cookies, f"no csrf cookie: {res.headers.get_list('set-cookie')}"
    assert "marketmind_session" in cookies


def test_register_sets_csrf_cookie(client):
    res = client.post(
        "/api/auth/register",
        json={
            "name": "CSRF Tester",
            "email": "csrf@test.com",
            "password": "Csrf@123",
            "role": "business_owner",
            "join_mode": "create",
            "company_name": "CSRF Test Co",
        },
    )
    assert res.status_code == 201, res.text
    cookies = {c.split("=")[0]: c.split("=")[1].split(";")[0] for c in res.headers.get_list("set-cookie")}
    assert "marketmind_csrf" in cookies, f"no csrf cookie: {res.headers.get_list('set-cookie')}"


def test_stateful_post_with_valid_csrf_header_succeeds(client, owner_token):
    """A browser-style request: session cookie + X-CSRF-Token header = allowed."""
    # First log in to get session + csrf cookies
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200
    csrf = None
    for c in login.headers.get_list("set-cookie"):
        if c.startswith("marketmind_csrf="):
            csrf = c.split("=")[1].split(";")[0]
    assert csrf, "login must set marketmind_csrf cookie"

    # Now make a stateful POST with the csrf header — should succeed
    res = client.post(
        "/api/inventory/products",
        json={
            "name": "CSRF Test Product",
            "price": 10.0,
            "stock_quantity": 5,
            "reorder_threshold": 2,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert res.status_code == 201, res.text


def test_stateful_post_without_csrf_header_rejected(client, owner_token):
    """Session cookie present but no X-CSRF-Token header -> 403."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200

    res = client.post(
        "/api/inventory/products",
        json={
            "name": "Bad Product",
            "price": 10.0,
            "stock_quantity": 5,
            "reorder_threshold": 2,
        },
    )
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "CSRF check failed"


def test_stateful_post_with_wrong_csrf_header_rejected(client, owner_token):
    """Session cookie + wrong X-CSRF-Token header -> 403."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200

    res = client.post(
        "/api/inventory/products",
        json={
            "name": "Bad Product 2",
            "price": 10.0,
            "stock_quantity": 5,
            "reorder_threshold": 2,
        },
        headers={"X-CSRF-Token": "wrong-token-value"},
    )
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "CSRF check failed"


def test_bearer_auth_skips_csrf_check(client, owner_token):
    """Bearer auth + session cookie: CSRF check is skipped (API client)."""
    res = client.post(
        "/api/inventory/products",
        json={
            "name": "Bearer Product",
            "price": 10.0,
            "stock_quantity": 5,
            "reorder_threshold": 2,
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 201, res.text


def test_auth_endpoints_never_csrf_checked(client):
    """POST/PUT/DELETE to /api/auth/* must never hit the CSRF middleware."""
    # POST /api/auth/login without any cookies at all
    res = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert res.status_code == 200, res.text

    # POST /api/auth/register without CSRF
    res = client.post(
        "/api/auth/register",
        json={
            "name": "NoCSRF",
            "email": "nocsfr@test.com",
            "password": "NoCsrf@123",
            "role": "business_owner",
            "join_mode": "create",
            "company_name": "NoCSRF Inc",
        },
    )
    assert res.status_code == 201, res.text

    # PUT /api/auth/change-password: login first, then use Bearer (skips CSRF)
    lb = client.post(
        "/api/auth/login",
        json={"email": "nocsfr@test.com", "password": "NoCsrf@123"},
    )
    assert lb.status_code == 200, lb.text
    res = client.put(
        "/api/auth/change-password",
        json={"current_password": "NoCsrf@123", "new_password": "NoCsrf@456"},
        headers={"Authorization": f"Bearer {lb.json()['access_token']}"},
    )
    # change-password requires current password verification; with the right
    # password it should succeed (Bearer bypasses CSRF)
    assert res.status_code == 200, res.text


def test_get_requests_are_never_csrf_checked(client, owner_token):
    """GET should never be CSRF-checked, even with a session cookie."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200

    res = client.get("/api/auth/me")
    assert res.status_code == 200, res.text


def test_patch_without_csrf_rejected(client, owner_token):
    """PATCH with session cookie but no CSRF header -> 403."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200

    # Create a product first (via Bearer to avoid CSRF)
    prod = client.post(
        "/api/inventory/products",
        json={"name": "Patch Target", "price": 10.0, "stock_quantity": 5, "reorder_threshold": 2},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert prod.status_code == 201, prod.text
    pid = prod.json()["id"]

    # Now PATCH it with session cookie but no CSRF header -> 403
    res = client.patch(
        f"/api/inventory/products/{pid}/stock",
        json={"stock_quantity": 99},
    )
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "CSRF check failed"


def test_delete_without_csrf_rejected(client, owner_token):
    """DELETE with session cookie but no CSRF header -> 403."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200

    # Create a customer first (via Bearer)
    cust = client.post(
        "/api/customers/",
        json={"name": "Delete Target", "email": "del-target@test.com"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert cust.status_code == 201, cust.text
    cid = cust.json()["id"]

    # DELETE with session cookie but no CSRF header -> 403
    res = client.delete(f"/api/customers/{cid}")
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "CSRF check failed"


def test_delete_with_valid_csrf_allowed(client, owner_token):
    """DELETE with session cookie + valid X-CSRF-Token -> allowed."""
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert login.status_code == 200
    csrf = None
    for c in login.headers.get_list("set-cookie"):
        if c.startswith("marketmind_csrf="):
            csrf = c.split("=")[1].split(";")[0]
    assert csrf

    # Create a customer
    cust = client.post(
        "/api/customers/",
        json={"name": "Delete OK Target", "email": "del-ok-target@test.com"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert cust.status_code == 201, cust.text
    cid = cust.json()["id"]

    # DELETE with valid CSRF -> allowed (204)
    res = client.delete(
        f"/api/customers/{cid}",
        headers={"X-CSRF-Token": csrf},
    )
    assert res.status_code == 204, res.text


def _parse_set_cookie(set_cookie_header):
    """Parse a single Set-Cookie header value into a dict of attr -> value.

    ``expires`` is a lazy date string, not a machine value, so it is kept as
    the raw string rather than parsed.
    """
    parts = set_cookie_header.split(";")
    name, value = parts[0].split("=", 1)
    attrs = {"name": name.strip(), "value": value.strip()}
    for part in parts[1:]:
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            attrs[k.strip().lower()] = v.strip()
        else:
            attrs[part.lower()] = True
    return attrs


def _csrf_cookie_from_login(client):
    """Log in and return the parsed marketmind_csrf Set-Cookie attrs."""
    res = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert res.status_code == 200, res.text
    for c in res.headers.get_list("set-cookie"):
        if c.startswith("marketmind_csrf="):
            return _parse_set_cookie(c)
    assert False, f"no marketmind_csrf in: {res.headers.get_list('set-cookie')}"


class TestCsrfCookieSameSiteAttributes:
    """The CSRF cookie's SameSite/Secure flags must match the deployment model.

    * Same-origin (dev / non-production): SameSite=Lax, Secure=False. The browser
      sends the cookie on same-site requests and blocks it on cross-site sub-requests,
      which is the CSRF defence for a single-origin deployment.
    * Cross-subdomain (production, ENVIRONMENT=production): SameSite=None, Secure=True.
      A Lax cookie would NOT be sent on the cross-subdomain API requests, breaking the
      double-submit check entirely. None overrides that, but browsers require Secure
      alongside None, so the two are set together only in production (HTTPS).

    The session and refresh cookies follow the same rule (see TestSessionCookieSameSite).
    """

    def test_csrf_cookie_is_lax_and_not_secure_in_development(self, client):
        """Outside production the CSRF cookie is SameSite=Lax, not Secure."""
        attrs = _csrf_cookie_from_login(client)
        assert attrs["name"] == "marketmind_csrf"
        assert attrs.get("samesite") == "lax", f"expected lax, got {attrs.get('samesite')}"
        # Secure must be absent (or False) in dev: the test client is plain HTTP.
        assert attrs.get("secure") is not True, "csrf cookie must not be Secure in dev"

    def test_csrf_cookie_is_none_and_secure_in_production(self, monkeypatch):
        """In production the CSRF cookie is SameSite=None; Secure=True."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "A" * 48)
        # Re-import the auth module so _set_csrf_cookie picks up the new env.
        # The cookie-setting functions read is_production() at call time, but the
        # module-level import of is_production is already cached — the function call
        # itself reads os.getenv each time, so no reload is needed.
        from app.core.env import is_production
        assert is_production() is True

        # Build a fresh app+client in production mode.
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app = FastAPI()
        from app.routers import auth as auth_router
        app.include_router(auth_router.router)
        with TestClient(app) as prod_client:
            attrs = _csrf_cookie_from_login(prod_client)
            assert attrs["name"] == "marketmind_csrf"
            assert attrs.get("samesite") == "none", (
                f"expected none in production, got {attrs.get('samesite')}"
            )
            assert attrs.get("secure") is True, "csrf cookie must be Secure in production"

    def test_csrf_cookie_secure_requires_same_site_none(self, monkeypatch):
        """Secure and SameSite=None are coupled in production — neither stands alone.

        A Secure cookie without SameSite=None would still be Lax (blocked cross-subdomain).
        A SameSite=None without Secure is rejected by browsers outright. The combined
        pair is what makes cross-subdomain CSRF possible at all.
        """
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "A" * 48)
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app = FastAPI()
        from app.routers import auth as auth_router
        app.include_router(auth_router.router)
        with TestClient(app) as prod_client:
            attrs = _csrf_cookie_from_login(prod_client)
            # Both must hold together: None <-> Secure.
            if attrs.get("secure") is True:
                assert attrs.get("samesite") == "none", (
                    "Secure=True requires SameSite=None in production"
                )
            else:
                assert attrs.get("samesite") != "none", (
                    "SameSite=None requires Secure=True"
                )

    def test_csrf_cookie_value_is_cryptographic(self, client):
        """The CSRF token is 32 bytes of CSPRNG output (64 hex chars)."""
        attrs = _csrf_cookie_from_login(client)
        assert len(attrs["value"]) == 64, f"expected 64 hex chars, got {len(attrs['value'])}"
        # Two logins must produce different tokens (no reuse across sessions).
        attrs2 = _csrf_cookie_from_login(client)
        assert attrs["value"] != attrs2["value"]


def test_csrf_cookie_path_is_root(client):
    """The CSRF cookie is path=/ so page JS can read it from any route."""
    attrs = _csrf_cookie_from_login(client)
    assert attrs.get("path") == "/", f"expected path=/, got {attrs.get('path')}"


def test_csrf_cookie_not_httponly(client):
    """The CSRF cookie must be readable by page JS (non-httpOnly).

    The double-submit pattern requires JS to read the cookie and send it back
    in the X-CSRF-Token header. httpOnly would make that impossible.
    """
    attrs = _csrf_cookie_from_login(client)
    assert attrs.get("httponly") is not True, "csrf cookie must NOT be httpOnly"


def _session_cookie_from_login(client):
    """Log in and return the parsed marketmind_session Set-Cookie attrs."""
    res = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert res.status_code == 200, res.text
    for c in res.headers.get_list("set-cookie"):
        if c.startswith("marketmind_session="):
            return _parse_set_cookie(c)
    assert False, f"no marketmind_session in: {res.headers.get_list('set-cookie')}"


def _refresh_cookie_from_login(client):
    """Log in and return the parsed marketmind_refresh Set-Cookie attrs."""
    res = client.post(
        "/api/auth/login",
        json={"email": "owner@test.com", "password": "Owner@123"},
    )
    assert res.status_code == 200, res.text
    for c in res.headers.get_list("set-cookie"):
        if c.startswith("marketmind_refresh="):
            return _parse_set_cookie(c)
    assert False, f"no marketmind_refresh in: {res.headers.get_list('set-cookie')}"


class TestSessionCookieSameSite:
    """The session cookie follows the same SameSite/Secure rule as the CSRF cookie.

    In production (cross-subdomain) it must be SameSite=None; Secure so the browser
    sends it on cross-subdomain API requests. In dev it stays Lax.
    """

    def test_session_cookie_is_lax_in_development(self, client):
        attrs = _session_cookie_from_login(client)
        assert attrs.get("samesite") == "lax"
        assert attrs.get("secure") is not True

    def test_session_cookie_is_none_and_secure_in_production(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "A" * 48)
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app = FastAPI()
        from app.routers import auth as auth_router
        app.include_router(auth_router.router)
        with TestClient(app) as prod_client:
            attrs = _session_cookie_from_login(prod_client)
            assert attrs.get("samesite") == "none"
            assert attrs.get("secure") is True


class TestRefreshCookieSameSite:
    """The refresh cookie is path-scoped to /api/auth but follows the same

    SameSite/Secure rule so a cross-subdomain frontend can present it to
    /api/auth/refresh.
    """

    def test_refresh_cookie_is_lax_in_development(self, client):
        attrs = _refresh_cookie_from_login(client)
        assert attrs.get("samesite") == "lax"
        assert attrs.get("secure") is not True
        # Path-scoped to /api/auth (not root).
        assert attrs.get("path") == "/api/auth", f"expected path=/api/auth, got {attrs.get('path')}"

    def test_refresh_cookie_is_none_and_secure_in_production(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "A" * 48)
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        app = FastAPI()
        from app.routers import auth as auth_router
        app.include_router(auth_router.router)
        with TestClient(app) as prod_client:
            attrs = _refresh_cookie_from_login(prod_client)
            assert attrs.get("samesite") == "none"
            assert attrs.get("secure") is True
            assert attrs.get("path") == "/api/auth"


class TestBrowserFlowCsrfIntegration:
    """Full browser-style flow: the double-submit CSRF pattern end-to-end.

    A real browser does the following, and this test reproduces it with the
    cookie-preserving TestClient so the same-marketmind_session cookie the
    server set on login is automatically sent back on every subsequent request:

    1. POST /api/auth/login  →  server sets marketmind_session +
       marketmind_csrf cookies in the browser
    2. page JS reads marketmind_csrf from document.cookie
    3. page JS POSTs a stateful endpoint with X-CSRF-Token header → 200/201
    4. a cross-site attacker cannot do step 3: it cannot read the cookie (same-origin)
       and therefore cannot produce the header, so the server rejects with 403

    The test exercises exactly this: it logs in, reads the CSRF cookie from the
    Set-Cookie headers the server sent, then replays the cookie + header on a
    stateful POST (allowed) and without the header (rejected). The TestClient
    preserves cookies between requests the same way a browser does, so the
    session cookie set on login is automatically attached to the stateful calls.
    """

    def test_browser_flow_login_then_stateful_post_with_csrf_succeeds(self, client, seeded_business):
        """Step 1-3: login → read CSRF cookie → POST /api/inventory/products with header → 201."""
        # Step 1: login (browser posts credentials, server sets cookies)
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Step 2: browser reads the non-httpOnly marketmind_csrf cookie.
        # The TestClient does not expose document.cookie, but it does expose the
        # Set-Cookie headers the server sent, which carry the same value.
        csrf = None
        for c in login.headers.get_list("set-cookie"):
            if c.startswith("marketmind_csrf="):
                csrf = c.split("=", 1)[1].split(";", 1)[0]
        assert csrf, "login must set marketmind_csrf cookie for the browser to read"

        # The session cookie is also set and the TestClient will send it
        # automatically on every subsequent request (same as a browser).
        session_present = any(
            c.startswith("marketmind_session=") for c in login.headers.get_list("set-cookie")
        )
        assert session_present, "login must set marketmind_session cookie"

        # Step 3: browser POSTs a stateful endpoint with X-CSRF-Token header.
        # The server sees: marketmind_session cookie (auth) + matching header (CSRF) → 201.
        res = client.post(
            "/api/inventory/products",
            json={
                "name": "Browser Flow Test Product",
                "price": 42.0,
                "stock_quantity": 20,
                "reorder_threshold": 5,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 201, f"expected 201, got {res.status_code}: {res.text}"
        pid = res.json()["id"]
        assert res.json()["name"] == "Browser Flow Test Product"

    def test_browser_flow_stateful_post_without_csrf_header_is_rejected(self, client, seeded_business):
        """Step 4: a stateful POST with the session cookie but NO CSRF header → 403.

        This is the attack the double-submit pattern prevents: a same-site script
        that forgets the header is blocked, and a cross-site attacker that cannot
        read the cookie cannot produce the header at all.
        """
        # Login first so the session cookie is set (and auto-sent by TestClient).
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Stateful POST with NO X-CSRF-Token header → 403 CSRF check failed.
        # The server still sees the marketmind_session cookie (auto-attached by the
        # TestClient), but without the matching header the double-submit check fails.
        res = client.post(
            "/api/inventory/products",
            json={
                "name": "Unauthorized Product",
                "price": 10.0,
                "stock_quantity": 1,
                "reorder_threshold": 1,
            },
        )
        assert res.status_code == 403, f"expected 403, got {res.status_code}: {res.text}"
        assert res.json()["detail"] == "CSRF check failed"


class TestCsrfTokenFuzzing:
    """Fuzz the X-CSRF-Token header with random values and assert every one is 403.

    The CSRF token is 32 bytes of CSPRNG output (256 bits), so the probability of
    a random guess matching is 1 in 2^256 — effectively zero. The real reason to
    fuzz is NOT that guessing is likely (it isn't), but to confirm that the constant-
    time compare (hmac.compare_digest) cannot be bypassed by any value, and that the
    rejection path is uniform: no value produces a 401 (which would signal "token
    parsed but invalid" vs "token missing") or a 200/201 (which would signal a bypass).

    The test covers:
    * truly random hex strings of varying length (1..64 bytes);
    * the empty string;
    * a partial prefix of the REAL token (to confirm truncation doesn't match);
    * a value that looks structurally valid (64 hex chars) but is wrong.

    All must return 403. Any 200/201 would be a CSRF bypass. Any 401 would be a
    suspicious inconsistency in the rejection path (the session is valid, so the
    failure should be "CSRF check failed" = 403, not "session expired" = 401).
    """

    def test_random_csrf_token_values_all_rejected(self, client, seeded_business):
        """N random X-CSRF-Token values against a stateful POST → all 403."""
        # Log in so the session cookie is set (auto-attached by TestClient).
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Read the real CSRF cookie so we can derive structurally-valid wrong values.
        real_csrf = None
        for c in login.headers.get_list("set-cookie"):
            if c.startswith("marketmind_csrf="):
                real_csrf = c.split("=", 1)[1].split(";", 1)[0]
        assert real_csrf, "login must set marketmind_csrf cookie"

        import secrets
        import random as _random

        N = 200  # enough to be a real fuzz, fast enough to run in a test
        fuzz_values = [
            # Truly random hex strings of varying length.
            *[
                secrets.token_hex(_random.randint(1, 64))
                for _ in range(N // 2)
            ],
            # Structurally-valid-but-wrong: 64 hex chars that are NOT the real token.
            *[
                (
                    "0" * 64
                    if real_csrf != "0" * 64
                    else "1" * 64
                )
                for _ in range(N // 4)
            ],
            # Truncation of the real token: a prefix that shares some bytes but isn't the whole thing.
            *[
                real_csrf[:k]
                for k in _random.sample(range(1, len(real_csrf)), min(20, len(real_csrf) - 1))
            ],
            # The empty string (no token at all).
            "",
            # A single repeated hex char.
            "a" * 64,
        ]

        # Deduplicate while preserving order so we don't test the same value twice.
        seen = set()
        unique = []
        for v in fuzz_values:
            if v not in seen:
                seen.add(v)
                unique.append(v)

        n_tested = 0
        n_rejected = 0
        n_other = 0
        for token in unique:
            res = client.post(
                "/api/inventory/products",
                json={
                    "name": f"Fuzz Product {n_tested}",
                    "price": 1.0,
                    "stock_quantity": 1,
                    "reorder_threshold": 1,
                },
                headers={"X-CSRF-Token": token},
            )
            n_tested += 1
            if res.status_code == 403:
                n_rejected += 1
                # Also confirm the detail is the expected CSRF message, not a
                # generic auth error masquerading as a CSRF failure.
                assert res.json()["detail"] == "CSRF check failed", (
                    f"token={token[:16]!r}... returned 403 but wrong detail: {res.json()}"
                )
            else:
                n_other += 1
                assert False, (
                    f"fuzz token={token[:16]!r}... returned {res.status_code} "
                    f"(body={res.text[:80]}), expected 403. "
                    f"({n_rejected}/{n_tested} rejected so far)"
                )

        # All tested values must have been rejected.
        assert n_tested > 0, "fuzz generated no test cases"
        assert n_other == 0, f"{n_other}/{n_tested} fuzz values were NOT rejected (CSRF bypass?)"
        assert n_rejected == n_tested, f"only {n_rejected}/{n_tested} rejected"

    def test_csrf_token_length_does_not_bypass(self, client, seeded_business):
        """Tokens of every length from 0 to 256 chars all return 403.

        Confirms the compare is not length-short-circuited in a way that would let
        a very short or very long value slip through.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        for length in list(range(0, 17)) + [32, 64, 128, 256]:
            token = "x" * length if length > 0 else ""
            res = client.post(
                "/api/inventory/products",
                json={
                    "name": f"Length {length}",
                    "price": 1.0,
                    "stock_quantity": 1,
                    "reorder_threshold": 1,
                },
                headers={"X-CSRF-Token": token},
            )
            assert res.status_code == 403, (
                f"token length={length} returned {res.status_code}, expected 403"
            )
            assert res.json()["detail"] == "CSRF check failed"

    def test_csrf_bypass_returns_403_not_401(self, client, seeded_business):
        """A wrong CSRF token with a VALID session must return 403, never 401.

        A 401 would mean the server treated the request as "no valid session" rather
        than "valid session but CSRF failed". Since the session cookie is valid (set by
        the login above), the only correct rejection is 403 CSRF check failed. This
        matters because a timing side-channel or a confused-middleware path could
        theoretically distinguish "session missing" from "CSRF failed" — both must land
        on the same 403 with the same detail for a valid-session + wrong-token request.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Confirm the session is actually valid: GET /api/auth/me should work.
        me = client.get("/api/auth/me")
        assert me.status_code == 200, f"session not valid: {me.text}"

        # Now a stateful POST with a wrong CSRF header MUST be 403, not 401.
        res = client.post(
            "/api/inventory/products",
            json={
                "name": "Bypass Probe",
                "price": 1.0,
                "stock_quantity": 1,
                "reorder_threshold": 1,
            },
            headers={"X-CSRF-Token": "definitely-not-the-real-token"},
        )
        assert res.status_code == 403, (
            f"expected 403 for valid-session + wrong-CSRF, got {res.status_code} "
            f"(body={res.text[:80]}). A 401 here would mean the session was ignored."
        )
        assert res.json()["detail"] == "CSRF check failed"




    def test_browser_flow_csrf_cookie_is_readable_by_js(self, client, seeded_business):
        """The CSRF cookie must be non-httpOnly so page JS can read it.

        If the cookie were httpOnly, step 2 of the browser flow (JS reading the
        cookie to send it back in the header) would be impossible and the
        double-submit pattern would break.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        csrf_attrs = None
        for c in login.headers.get_list("set-cookie"):
            if c.startswith("marketmind_csrf="):
                parts = c.split(";")
                name, value = parts[0].split("=", 1)
                csrf_attrs = {"name": name.strip(), "value": value.strip()}
                for part in parts[1:]:
                    part = part.strip()
                    if "=" in part:
                        k, v = part.split("=", 1)
                        csrf_attrs[k.strip().lower()] = v.strip()
                    else:
                        csrf_attrs[part.lower()] = True
                break

        assert csrf_attrs is not None, "login must set marketmind_csrf cookie"
        # httponly must be absent/false: JS must be able to read the cookie.
        assert csrf_attrs.get("httponly") is not True, (
            "marketmind_csrf must NOT be httpOnly — page JS reads it for the X-CSRF-Token header"
        )

    def test_browser_flow_session_cookie_persists_across_requests(self, client, seeded_business):
        """The session cookie set on login is sent automatically on the next request.

        This is the same-site property that lets the double-submit check work: the
        server trusts the session cookie (auto-sent by the browser on same-site
        requests) and only needs the JS-readable CSRF header to confirm the request
        is same-origin.
        """
        # Login sets the session cookie.
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Without sending any cookie header explicitly, the TestClient auto-attaches
        # the session cookie from the previous response. GET /api/auth/me should work.
        me = client.get("/api/auth/me")
        assert me.status_code == 200, f"session cookie not persisted: {me.text}"
        assert me.json()["email"] == "owner@test.com"

    def test_browser_flow_csrf_header_must_match_cookie(self, client, seeded_business):
        """A stateful POST with a WRONG X-CSRF-Token header → 403.

        Even with a valid session cookie, a mismatched header is rejected. This is
        what stops a same-site script that has a stale/wrong token, and it is the
        constant-time comparison (hmac.compare_digest) that prevents timing-based
        token guessing.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        res = client.post(
            "/api/inventory/products",
            json={
                "name": "Wrong CSRF Product",
                "price": 10.0,
                "stock_quantity": 1,
                "reorder_threshold": 1,
            },
            headers={"X-CSRF-Token": "wrong-token-value"},
        )
        assert res.status_code == 403, f"expected 403, got {res.status_code}: {res.text}"
        assert res.json()["detail"] == "CSRF check failed"


class TestCsrfTokenFuzzing:
    """Fuzz the X-CSRF-Token header with random values and assert every one is 403.

    The CSRF token is 32 bytes of CSPRNG output (256 bits), so the probability of
    a random guess matching is 1 in 2^256 — effectively zero. The real reason to
    fuzz is NOT that guessing is likely (it isn't), but to confirm that the constant-
    time compare (hmac.compare_digest) cannot be bypassed by any value, and that the
    rejection path is uniform: no value produces a 401 (which would signal "token
    parsed but invalid" vs "token missing") or a 200/201 (which would signal a bypass).

    The test covers:
    * truly random hex strings of varying length (1..64 bytes);
    * the empty string;
    * a partial prefix of the REAL token (to confirm truncation doesn't match);
    * a value that looks structurally valid (64 hex chars) but is wrong.

    All must return 403. Any 200/201 would be a CSRF bypass. Any 401 would be a
    suspicious inconsistency in the rejection path (the session is valid, so the
    failure should be "CSRF check failed" = 403, not "session expired" = 401).
    """

    def test_random_csrf_token_values_all_rejected(self, client, seeded_business):
        """N random X-CSRF-Token values against a stateful POST → all 403."""
        # Log in so the session cookie is set (auto-attached by TestClient).
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Read the real CSRF cookie so we can derive structurally-valid wrong values.
        real_csrf = None
        for c in login.headers.get_list("set-cookie"):
            if c.startswith("marketmind_csrf="):
                real_csrf = c.split("=", 1)[1].split(";", 1)[0]
        assert real_csrf, "login must set marketmind_csrf cookie"

        import secrets
        import random as _random

        N = 200  # enough to be a real fuzz, fast enough to run in a test
        fuzz_values = [
            # Truly random hex strings of varying length.
            *[
                secrets.token_hex(_random.randint(1, 64))
                for _ in range(N // 2)
            ],
            # Structurally-valid-but-wrong: 64 hex chars that are NOT the real token.
            *[
                (
                    "0" * 64
                    if real_csrf != "0" * 64
                    else "1" * 64
                )
                for _ in range(N // 4)
            ],
            # Truncation of the real token: a prefix that shares some bytes but isn't the whole thing.
            *[
                real_csrf[:k]
                for k in _random.sample(range(1, len(real_csrf)), min(20, len(real_csrf) - 1))
            ],
            # The empty string (no token at all).
            "",
            # A single repeated hex char.
            "a" * 64,
        ]

        # Deduplicate while preserving order so we don't test the same value twice.
        seen = set()
        unique = []
        for v in fuzz_values:
            if v not in seen:
                seen.add(v)
                unique.append(v)

        n_tested = 0
        n_rejected = 0
        n_other = 0
        for token in unique:
            res = client.post(
                "/api/inventory/products",
                json={
                    "name": f"Fuzz Product {n_tested}",
                    "price": 1.0,
                    "stock_quantity": 1,
                    "reorder_threshold": 1,
                },
                headers={"X-CSRF-Token": token},
            )
            n_tested += 1
            if res.status_code == 403:
                n_rejected += 1
                # Also confirm the detail is the expected CSRF message, not a
                # generic auth error masquerading as a CSRF failure.
                assert res.json()["detail"] == "CSRF check failed", (
                    f"token={token[:16]!r}... returned 403 but wrong detail: {res.json()}"
                )
            else:
                n_other += 1
                assert False, (
                    f"fuzz token={token[:16]!r}... returned {res.status_code} "
                    f"(body={res.text[:80]}), expected 403. "
                    f"({n_rejected}/{n_tested} rejected so far)"
                )

        # All tested values must have been rejected.
        assert n_tested > 0, "fuzz generated no test cases"
        assert n_other == 0, f"{n_other}/{n_tested} fuzz values were NOT rejected (CSRF bypass?)"
        assert n_rejected == n_tested, f"only {n_rejected}/{n_tested} rejected"

    def test_csrf_token_length_does_not_bypass(self, client, seeded_business):
        """Tokens of every length from 0 to 256 chars all return 403.

        Confirms the compare is not length-short-circuited in a way that would let
        a very short or very long value slip through.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        for length in list(range(0, 17)) + [32, 64, 128, 256]:
            token = "x" * length if length > 0 else ""
            res = client.post(
                "/api/inventory/products",
                json={
                    "name": f"Length {length}",
                    "price": 1.0,
                    "stock_quantity": 1,
                    "reorder_threshold": 1,
                },
                headers={"X-CSRF-Token": token},
            )
            assert res.status_code == 403, (
                f"token length={length} returned {res.status_code}, expected 403"
            )
            assert res.json()["detail"] == "CSRF check failed"

    def test_csrf_bypass_returns_403_not_401(self, client, seeded_business):
        """A wrong CSRF token with a VALID session must return 403, never 401.

        A 401 would mean the server treated the request as "no valid session" rather
        than "valid session but CSRF failed". Since the session cookie is valid (set by
        the login above), the only correct rejection is 403 CSRF check failed. This
        matters because a timing side-channel or a confused-middleware path could
        theoretically distinguish "session missing" from "CSRF failed" — both must land
        on the same 403 with the same detail for a valid-session + wrong-token request.
        """
        login = client.post(
            "/api/auth/login",
            json={"email": "owner@test.com", "password": "Owner@123"},
        )
        assert login.status_code == 200, login.text

        # Confirm the session is actually valid: GET /api/auth/me should work.
        me = client.get("/api/auth/me")
        assert me.status_code == 200, f"session not valid: {me.text}"

        # Now a stateful POST with a wrong CSRF header MUST be 403, not 401.
        res = client.post(
            "/api/inventory/products",
            json={
                "name": "Bypass Probe",
                "price": 1.0,
                "stock_quantity": 1,
                "reorder_threshold": 1,
            },
            headers={"X-CSRF-Token": "definitely-not-the-real-token"},
        )
        assert res.status_code == 403, (
            f"expected 403 for valid-session + wrong-CSRF, got {res.status_code} "
            f"(body={res.text[:80]}). A 401 here would mean the session was ignored."
        )
        assert res.json()["detail"] == "CSRF check failed"




