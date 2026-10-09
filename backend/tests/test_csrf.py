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
