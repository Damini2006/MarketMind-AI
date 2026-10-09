# MarketMind AI — Deployment Readiness & Security Review

**Date:** 9 October 2026
**Scope:** the whole deployable application — backend (`backend/`), frontend
(`frontend/`), the compose stack, CI, and the configuration surface that decides
whether a real deployment is safe.
**Question being answered:** "is this ready for deployment, and can anyone simply
hack it?"
**Short answer:** the *plumbing* is genuinely production-grade (non-root images,
CI gates, health probes, a deploy smoke test, no secrets in git, no leaked
credentials in history). The *exposure* surface was not: a fresh production
database seeded four accounts whose passwords are published in this repository —
including a global admin — and a handful of smaller holes surrounded it. The
worst of those are fixed in this change; what remains is listed by priority
below with the reasoning for each.

---

## 1. Verdict

| Area | Before | After this change |
| :--- | :---: | :---: |
| Secrets in git / git history | ✅ clean | ✅ clean |
| Container hardening (non-root, no-new-privileges, caps, log rotation) | ✅ good | ✅ good |
| CI (tests, frontend build, image guards, deploy smoke) | ✅ present | ✅ present |
| Schema migration on deploy | ✅ Alembic at startup, non-fatal | ✅ same |
| Fresh-deploy account safety | ❌ published admin password seeded | ✅ no demo accounts in production |
| JWT signing-key handling | ⚠️ silent random fallback | ✅ refuses to start in production |
| CORS | ⚠️ `*` would be honoured with credentials | ✅ `*` stripped + warned |
| Cross-tenant data isolation | ⚠️ AI chat leaked every tenant's users | ✅ scoped + regression test |
| Reset-OTP randomness | ⚠️ Mersenne Twister | ✅ CSPRNG |
| Browser security headers | ❌ none | ✅ nosniff, frame-deny, HSTS, minimal CSP |
| Session storage / XSS exposure | ❌ JWT in `localStorage` | ❌ unchanged (see P1-1) |
| Full CSP | ❌ | ⚠️ partial by design (see P2-1) |

---

## 2. What this change fixes

### 2.1 Demo accounts are no longer created in production — the critical one

`backend/app/seed_data.py` created four users on any empty database:

| Email | Password | Role |
| :--- | :--- | :--- |
| `owner@marketmind.ai` | `Owner@123` | business_owner |
| `manager@marketmind.ai` | `Manager@123` | store_manager |
| `sales@marketmind.ai` | `Sales@123` | sales_executive |
| `admin@marketmind.ai` | `Admin@123` | **admin** |

Those exact strings appear in `README.md`, `sample-data/README.md`,
`frontend/public/sample-data/README.md`, `docker-compose.yml` and
`backend/tests/conftest.py`. `seed_if_empty` runs from a startup hook, so the
first production boot would publish a working admin login on the internet. That
is the entire "anyone can hack it" answer — no exploit needed, just the repo.

Now: `backend/app/core/env.py` classifies the process, and seeding runs only
outside production. `ENVIRONMENT=production` (or `prod`) means a fresh database
starts empty and the first user registers as its own business owner.
`SEED_DEMO_DATA=true` is the explicit override for a staging box.

The demo *team members* inside `seed_business_demo_data` (password `Demo@123`)
were gated by the same switch, so neither path can create a known-password
account in production.

### 2.2 The JWT key must be real in production

`backend/app/core/security.py` generated a random in-memory key when
`JWT_SECRET_KEY` was unset, and logged a warning. Convenient locally, wrong in a
deployment: the key is the whole authentication boundary, and a copy-pasted
placeholder (`your-random-secret-min-32-chars`) is 31 characters of nothing.
In production the process now refuses to start unless the secret is present, at
least 32 characters, and not one of the known placeholder values.

The placeholder check deliberately runs *before* the length check — the example
value is 31 characters, so the length rule would otherwise report "too short"
and hide the real problem (someone copied the template and never replaced it).

`ACCESS_TOKEN_EXPIRE_MINUTES` was also read by `conftest.py` but ignored by the
module, which hard-coded 12 hours. It is now honoured, so a deployment can
shorten sessions without a code change. Tokens gained an `iat` claim for
auditability and a `jti` claim so no two mints are byte-identical.

The default has since been shortened from 12h to **3h**, paired with a
refresh-token endpoint (`POST /api/auth/refresh`): refresh tokens live in an
httpOnly cookie scoped to `/api/auth`, are stored server-side only as SHA-256
hashes, and rotate on every use — replaying a rotated token outside a 30-second
multi-tab grace window revokes the entire token family (the theft response).
Logout and password changes burn them too.

### 2.3 Cross-tenant leak in the AI assistant

`GET /api/ai/chat` scoped sales, products, customers and invoices to the
caller's business — *unless* `business_id` was falsy, in which case it queried
the whole table for every tenant. Worse, the "team" branch had no filter at all:

```python
users = db.query(models.User).all()   # names + count of EVERY tenant's users
```

Any authenticated user of any tenant could ask "show team" and be told the names
of users belonging to every other business in the database. Fixed: the endpoint
now requires a business id (403 otherwise) and every query, including the team
and anomaly branches, is scoped to it. Two regression tests in
`backend/tests/test_tenant_isolation.py` fail if the leak returns.

### 2.4 CORS wildcard no longer silently defeats the allow-list

`allow_credentials=True` means the origin list *is* the boundary: an entry of
`*` would let any site a logged-in user visits read their data. `CORS_ORIGINS`
containing `*` previously produced exactly that. `parse_cors_origins` in
`backend/app/core/env.py` now strips it and `main.py` logs a loud warning;
allowed methods are an explicit list instead of `["*"]`. Unit-tested in
`backend/tests/test_production_hardening.py`.

### 2.5 Password-reset OTPs come from a CSPRNG

`auth.py` used `random.randint` (Mersenne Twister — a predictable stream) for
the 6-digit reset code. Now `secrets.randbelow`. The rate limit (10 tries per
mailbox per 10 minutes) already bounded brute force; this removes the
predictability argument entirely.

### 2.6 Browser security headers

`frontend/security-headers.conf` (new) is included by `frontend/nginx.conf` and
copied into the image by `frontend/Dockerfile`:

- `X-Content-Type-Options: nosniff` — an uploaded file misread as HTML is the
  classic stored-XSS path.
- `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` — clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` denying geolocation/microphone/camera/payment/usb.
- `Cross-Origin-Opener-Policy: same-origin`.
- `Strict-Transport-Security`.
- A deliberately conservative CSP (`object-src 'none'; base-uri 'self';
  frame-ancestors 'self'`) — see P2-1 for why it stops there.

One nginx subtlety worth knowing: `add_header` does **not** merge across levels,
so the cached-asset `location` block (which sets `Cache-Control`) would drop every
server-level header. It includes the same file. Verified with
`nginx -t` against the real image (`nginx:alpine`): configuration is valid and
the include resolves.

### 2.7 Local build config is out of the image and out of git

`frontend/.dockerignore` and `frontend/.gitignore` now exclude `.env` / `.env.*`.
A developer's Vite env file would otherwise be copied into the build context and
could override `VITE_*` values inside the image; and since Vite compiles those
into the public bundle, a secret there would ship to every visitor.

### 2.8 Tests

`backend/tests/test_production_hardening.py` (new, 21 cases) covers environment
detection, CORS-wildcard stripping, the demo-seeding switch, and — in a
subprocess, because the guard fires at import time — that a missing, short, or
placeholder JWT secret aborts startup while a strong one does not.
`test_tenant_isolation.py` gained the two AI-chat cases.

Suite: **114 passed** (`python -m pytest tests/ -q`), up from 91.

---

## 3. Still to do

### P1 — finish before pointing a public domain at this

**P1-1. The session token lives in `localStorage`. — FIXED.**
The JWT now lives in an httpOnly, `Secure`, `SameSite=Lax` cookie issued by
the backend (`marketmind_session`), so page JS — and therefore any XSS payload
— cannot read it. The WebSocket handshake authenticates from the cookie rather
than a `?token=` query parameter (URLs land in logs), a double-submit CSRF
cookie backs up `SameSite=Lax`, and access tokens are 3h with a rotating
httpOnly refresh cookie (`marketmind_refresh`, path-scoped to `/api/auth`)
renewing them silently. The login response still returns `access_token` in the
body purely for API clients such as the deploy smoke test; the browser never
stores it.

**P1-2. The "two-factor authentication" screen is not two-factor.**
`frontend/src/pages/Settings.jsx` generates a TOTP secret, renders a QR code, and
stores the secret and backup codes in `localStorage`. Nothing on the backend ever
verifies a code, and `backend/app/models.py` has no 2FA columns wired to
enforcement (`d1e2f3a4b5c6_add_dob_and_2fa_fields.py` added fields that are never
checked at login). It is security theatre: a user who enables it believes their
account is protected. Either implement server-side TOTP verification at login or
remove the UI — leaving it as-is is worse than not offering it.

**P1-3. `/docs`, `/redoc` and `/openapi.json` are public in production.**
Not a vulnerability on its own (the API requires auth), but it is a free map of
every endpoint, parameter and schema. Note `scripts/smoke_test.py` asserts
`/openapi.json` is reachable, so gating this needs a matching smoke-test change
(env-gated `docs_url=None` is the usual pattern).

**P1-4. Rate limiting is per-process memory.**
`_rate_store` in `auth.py` is a module-level dict. A restart or redeploy clears
every lockout, and running more than one uvicorn worker multiplies an attacker's
budget by the worker count. It is correct today only because the deployment is
single-worker — which is also what makes the in-process TTL cache consistent.
If or when you scale out, both need a shared store (Redis).

**P1-5. Terminate TLS in front, and do not publish the backend port.**
`docker-compose.yml` publishes `${BACKEND_PORT:-8000}:8000`, so the API is
reachable directly, bypassing nginx (no security headers, no single choke point).
In production either drop that port mapping or put the whole stack behind a TLS
terminator / ingress and allow only 443.

**P1-6. There is no way to create an `admin` in production any more.**
Registration only ever produces a `business_owner`, and inviting an admin
requires an existing admin. That is a correct default (P1-6 is a feature, not a
bug) but it must be paired with a documented bootstrap path — a small
`backend/create_admin.py` CLI run once against the database, or a
`BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` pair consumed on first startup.

### P2 — should do, roughly in this order

**P2-1. Complete the Content-Security-Policy.** The current policy intentionally
avoids `script-src`/`style-src`/`connect-src`. A full policy must be tested
against the built bundle, and it has three known obstacles: the inline dark-mode
bootstrap script in `frontend/index.html` (needs a `sha256-` hash or a nonce),
Leaflet map tiles from `https://*.tile.openstreetmap.org` (`img-src`), and the
QR image from `https://api.qrserver.com` (`img-src`). Do it with the built image
and the browser devtools, not blind.

**P2-2. Invite emails contain a plaintext password.**
`backend/app/routers/users.py` emails the initial password the admin typed. A
one-time signed invite link (or a forced-reset token) removes a credential from
the mail path.

**P2-3. No dependency-vulnerability gate in CI.** `requirements.txt` is fully
pinned (good) and `frontend` uses `npm ci` (good), but nothing checks for known
CVEs. Add `pip-audit` and `npm audit --omit=dev` (or Dependabot) as a CI job.

**P2-4. Cheap-but-unbounded endpoints.** `/api/ai/*` retrains scikit-learn
models; the TTL cache means one expensive compute per business per 10 minutes,
but there is no per-user throttle, so a logged-in user can still pin a core by
cycling businesses or waiting out the TTL. A simple per-user rate limit on
`/api/ai/*` closes it.

**P2-5. EXIF in uploaded avatars.** Avatars are magic-byte validated, size
capped (5 MB), and named server-side — genuinely solid. Re-encoding through
Pillow would additionally strip GPS metadata from a photo the user did not know
they were publishing.

**P2-6. Two Alembic trees.** `backend/alembic/versions/` is live (used by
`app/migrate.py`); `backend/migrations/versions/0001…0008` is a legacy parallel
history that nothing applies. Delete it or mark it unmistakably do-not-use —
two migration directories is how a schema diverges silently.

**P2-7. `Base.metadata.create_all` at import.** Convenient, and it makes a fresh
database work, but it means the app mutates schema as a side effect of importing
it. Alembic is the real mechanism here; `create_all` is the safety net. Keep, but
know that a model change deploys a schema change with no migration review.

**P2-8. `migrate.py` builds DDL with f-strings.** Every interpolated value is an
internal constant (`TENANT_TABLES`, `USER_EXTRA_COLUMNS`), so there is no
injection today. Worth a comment so nobody interpolates input later.

### P3 — nice to have

- No `render.yaml` / `vercel.json` / Fly config: deployment is a manual
  checklist. Infrastructure-as-code would make it reproducible and reviewable.
- `backend/.env.example` should gain the three new variables
  (`ENVIRONMENT`, `SEED_DEMO_DATA`, `ACCESS_TOKEN_EXPIRE_MINUTES`). Tooling
  refused to edit a dotenv-family file, so they are documented in `README.md`
  instead — paste the block below.
- `frontend/Dockerfile` runs the nginx master as root by design (documented in
  the file); `nginxinc/nginx-unprivileged` + port 8080 would remove that if the
  extra port-mapping work is acceptable.

```dotenv
ENVIRONMENT=production             # development (default) | production
ACCESS_TOKEN_EXPIRE_MINUTES=180   # optional, default 180 = 3h (refresh cookie renews)
REFRESH_TOKEN_EXPIRE_DAYS=30      # optional, default 30
# SEED_DEMO_DATA=false             # default: on in dev, off in production
```

---

## 4. What was verified, not assumed

| Check | Result |
| :--- | :--- |
| Secrets in tracked files (`git grep` for connection strings, API keys, private keys, AWS/GitHub/OpenAI tokens) | none; only `.env.example` placeholders and the `ci.env` throwaway values |
| Secrets in git history | none reachable (an earlier Neon credential was already purged in a prior cleanup) |
| Image contains no `.env` / effective uid non-root | already enforced by the `docker-build` CI job (`image-guard` steps) |
| Backend suite | `python -m pytest tests/ -q` → 114 passed |
| nginx config + include resolution | `nginx -t` inside `nginx:alpine` with the real files → syntax ok, test successful |
| `ENVIRONMENT=production` with no / short / placeholder secret | process exits 1 with a clear `[config]` message (4 subprocess tests) |
| `ENVIRONMENT=production` demo seeding | off by default, `SEED_DEMO_DATA=true` overrides (3 unit tests) |
| `CORS_ORIGINS=*` | wildcard dropped, warning logged at import (4 unit tests) |
| AI chat as an empty tenant | no other tenant's users or revenue in the answer (2 tests) |

---

## 5. Deployment runbook (short form)

1. `ENVIRONMENT=production` on the backend host. If you skip this, none of the
   strict checks below apply and the demo accounts come back.
2. `DATABASE_URL` → Neon **direct** endpoint, `?sslmode=require`.
3. `JWT_SECRET_KEY` → `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   The app refuses to start without it.
4. `CORS_ORIGINS` → the exact frontend origin(s), no `*`. Not needed at all for
   the compose stack (nginx serves the SPA and proxies `/api` same-origin).
5. TLS in front of the stack; do not publish the backend port.
6. Confirm the database has no `@marketmind.ai` demo users (see the README
   checklist item).
7. `SMOKE_EMAIL` / `SMOKE_PASSWORD` set to a **real** account, then
   `python scripts/smoke_test.py` — the defaults are the demo login.
