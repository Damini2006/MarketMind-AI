# Deploying MarketMind AI

Three pieces, deliberately separate:

| Piece | Host | Config in repo |
|---|---|---|
| API (FastAPI + uvicorn, long-lived process) | **Railway** — Docker service, root directory `/backend` | [`backend/Dockerfile`](backend/Dockerfile), [`scripts/verify_port.sh`](scripts/verify_port.sh) |
| SPA (Vite static build) | **Vercel** — static | [`frontend/vercel.json`](frontend/vercel.json) |
| Database | **Neon** Postgres (already in use) | connection string only, never committed |

**Why not one host?** The API must run a persistent Python process with a
connection pool, background threads and startup migrations. Vercel runs
serverless/edge functions and cannot host it, so the SPA and the API live on
different origins. Everything below follows from that one constraint.

---

## 0. Before you start

* Accounts: Railway, Vercel, Neon (already have a database).
* GitHub repo: `Damini2006/MarketMind-AI`.
* **The repo has exactly one branch: `Rishika-Damini-Neelam`.** There is no
  `main`, and this branch is 126 commits ahead of the local `main` — so Railway
  and Vercel must both be pointed at `Rishika-Damini-Neelam`. If you later
  create a `main`, change both hosts' production branch together.

## 1. Commit and push the deploy files

These are new/changed and must be on the branch the hosts build from:

```
backend/Dockerfile          # changed — the image now binds $PORT (default 8000)
frontend/vercel.json        # new — static build + SPA rewrites
scripts/verify_port.sh      # new — proves the $PORT contract locally
DEPLOY.md                   # this file
```

Neither host can see unpushed work. Railway, in particular, builds from GitHub
on every push to the branch.

**There is deliberately no `railway.json` / `railway.toml`.** Railway's
Config-as-Code is deprecated — the docs state that new services cannot opt into
it and that existing files stop being read on 2026-12-01. The replacement is
`.railway/railway.ts` applied through the Railway CLI, which needs the CLI plus
the `railway` npm package in the repo. For this app none of that is necessary:
Railway auto-detects `backend/Dockerfile` once the service's **Root Directory**
is set (step 3), and everything else is dashboard configuration.

## 2. Generate the secrets you will paste into Railway

Do these **now**, and treat the old values as dead:

```bash
# JWT signing key — the whole auth boundary. >= 32 chars, and the placeholder
# from .env.example is rejected outright at startup.
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

* **Neon** — Console → your project → branch → role `neondb_owner` → *Reset
  password*. Copy the connection string and **drop the `-pooler` label** from
  the host (e.g. `ep-x-pooler.c-4...` → `ep-x.c-4...`). This backend is a
  single long-lived process with its own SQLAlchemy pool, which is exactly what
  Neon's pooler is not for.
* **Gmail app password** (only if you want OTP password-reset emails) — Google
  Account → Security → App passwords: revoke the old one, create a new one.

## 3. Railway — the API

1. Railway → **New Project → Deploy from GitHub repo** →
   `Damini2006/MarketMind-AI`.
2. Service → **Settings → Source**: branch `Rishika-Damini-Neelam`.
3. Service → **Settings → Root Directory: `/backend`.**

   This is the step that matters most. Setting the root directory is what
   Railway pulls down for a build, so it becomes the Docker build context —
   identical to `context: ./backend` in [`docker-compose.yml`](docker-compose.yml),
   the context every local and CI build already uses. `backend/Dockerfile` is
   then found at the root of that context with no path to configure.

   Do **not** leave the root directory at `/`: the image would be built from a
   context containing the frontend, every `*.md` and the git history.
4. Service → **Variables**: add the ones in the table below. `DATABASE_URL`,
   `JWT_SECRET_KEY` and `CORS_ORIGINS` are the required three.
5. Service → **Settings → Deploy**: healthcheck path **`/health`**.

   `/health` is a plain unauthenticated route ([`app/main.py`](backend/app/main.py))
   — the only endpoint safe to poll before the app has a usable database
   session. Leave the start command empty: the image's own `CMD` binds `$PORT`,
   so local compose, CI and Railway all start identically. One source of truth.
6. **Settings → Networking → Generate Domain.** You get
   `https://<something>.up.railway.app`; this is your API base.

   **Do not set `PORT` yourself.** Railway injects the port it routes to, and
   the generated domain targets that same port. The image reads `PORT` and binds
   `0.0.0.0` (Railway's docs require the wildcard address); overriding it by hand
   is the classic cause of a 502 "Application failed to respond".
7. Deploy. First build downloads the Python wheels, so expect several minutes.

### Optional: persist uploaded avatars

Railway volumes survive deploys, unlike Render's free plan. If avatars matter:

* Service → **Volumes** → add one, mount path **`/app/uploads`**.

  That path is not a guess: the app derives it from its own file location
  (`dirname(dirname(__file__))/uploads` in [`app/main.py`](backend/app/main.py),
  avatars in [`app/routers/users.py`](backend/app/routers/users.py)), which is
  `/app/uploads` inside the image, and it is the same path compose mounts.

* **Check it before trusting it.** The container runs as uid 1000 (`appuser`),
  and a platform-created volume can arrive root-owned — in which case the app
  starts fine (it only `makedirs(..., exist_ok=True)` on this path) but avatar
  uploads fail with a permission error. Upload an avatar, redeploy, and confirm
  it still loads. If writes are refused, drop the volume: avatars then reset on
  every deploy, which is the Render-free behaviour anyway. Railway allows only
  one volume per service, and no replicas with a volume attached.

## 4. Vercel — the SPA

1. Vercel → **Add New → Project** → import `Damini2006/MarketMind-AI`.
2. **Root Directory: `frontend`.** (Without this Vercel builds the repo root
   and finds no `package.json`.)
3. Framework preset **Vite** is picked up from `frontend/vercel.json`, which
   also rewrites every path to `/index.html` so deep links such as
   `/dashboard` do not 404.
4. **Environment variable (Production):**

   ```
   VITE_API_BASE_URL = https://<something>.up.railway.app/api
   ```

   **The trailing `/api` is required.** The client is
   `VITE_API_BASE_URL || "/api"`, then appends `/auth/login` and friends.

   This matters more than it looks: `frontend/.env` is **gitignored**, so Vercel
   has no fallback value. If you skip the variable the bundle calls `/api/...`
   on the Vercel origin and every request 404s. Vite gives real environment
   variables priority over `.env` files, so setting it in the dashboard is
   enough — do not commit a `.env`.
5. Build and deploy.

## 5. Close the CORS loop (required)

The two origins are different, and the API allows credentials, so the exact
Vercel origin must be listed — a wildcard `*` is **refused** at startup.

Railway → service → **Variables** → set:

```
CORS_ORIGINS = https://<your-app>.vercel.app,https://<your-app>-git-main-<scope>.vercel.app
```

Exact origins, no trailing slash, comma-separated. Saving redeploys the service.

## 6. Verify the deployment

```bash
curl -s https://<something>.up.railway.app/health
# {"status":"healthy"}

SMOKE_BACKEND_URL=https://<something>.up.railway.app \
SMOKE_FRONTEND_URL=https://<your-app>.vercel.app \
SMOKE_EMAIL=<a real account you registered> \
SMOKE_PASSWORD=<its password> \
python scripts/smoke_test.py
```

[`scripts/smoke_test.py`](scripts/smoke_test.py) exits non-zero on any failure
and checks `/health`, the OpenAPI schema, that the SPA shell is really served,
an authenticated login, an authenticated call, the database round-trip, and
that anonymous callers get 401. The defaults are the demo account, so pass a
real one.

Locally, the same gate passed **8/8** against the running stack, including the
Neon round-trip.

## Cost and limits (worth knowing before a demo)

* The trial is **$5 of credit, up to 30 days**, and the Free plan adds **$1 of
  credit per month**. Railway stops services when credit runs out, so a long
  demo can outlive the free allowance. Hobby is $5/month.
* **Sleep is a setting here, not a default.** Railway's *Serverless* feature
  (formerly App-Sleeping) has to be enabled on a service; once on, it sleeps
  after ~5 minutes without outbound packets and the first request may return a
  **502** while it wakes. Check it is off before a demo — unlike Render's free
  tier, which spins down on its own, here you pay for the always-on container
  that avoids the cold start.
* **Restricted-trial caveat:** limited-trial accounts have restricted outbound
  network access. Since the database is external (Neon), a failed database
  connection on the very first deploy is most likely this, not your credentials.
  The app retries DNS failures with backoff
  ([`app/resilience.py`](backend/app/resilience.py)), but it cannot route around
  a blocked egress.
* With `ENVIRONMENT=production` the demo accounts are **not** seeded — the first
  visitor registers as its own owner. That is intended.
* The image contains no `.env` (`backend/.dockerignore` excludes it), and CI's
  `image-guard` job fails a build that ships one.

## Environment variables (backend)

| Variable | Required | Value |
|---|---|---|
| `ENVIRONMENT` | yes | `production` — enables the startup guards and stops demo seeding |
| `DATABASE_URL` | yes | Neon **direct** host, `?sslmode=require` |
| `JWT_SECRET_KEY` | yes | fresh ≥ 32 chars; missing/placeholder/short all abort startup |
| `CORS_ORIGINS` | yes | exact Vercel origin(s), no `*` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | default `180` (3h; the browser silently refreshes) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | default `30` |
| `SENDER_EMAIL` / `SENDER_PASSWORD` / `SMTP_SERVER` / `SMTP_PORT` | no | OTP reset emails only |

`PORT` is injected by the host; the image honours it (see
[`scripts/verify_port.sh`](scripts/verify_port.sh), which boots the real image
in production mode on both the default 8000 and an injected port).

## Cross-origin cookies

A Vercel → Railway request is cross-site, so the session, CSRF and refresh
cookies need `SameSite=None; Secure`. The app already does this when
`ENVIRONMENT=production` (covered by [`backend/tests/test_csrf.py`](backend/tests/test_csrf.py)),
which is one more reason not to leave `ENVIRONMENT` unset. `Secure` means
**HTTPS is required** on both hosts — both provide it by default.

Live alerts need no extra wiring. The socket host is derived from
`VITE_API_BASE_URL` with the `/api` suffix stripped, so the browser connects to
`wss://<api-host>/ws/alerts/<businessId>` directly
([`frontend/src/components/LiveAlerts.jsx`](frontend/src/components/LiveAlerts.jsx))
— no Vercel proxy involved. It is a cross-origin socket that authenticates with
the same session cookie, so if alerts never connect while the rest of the app
works, suspect the cookie flags (`ENVIRONMENT=production`) before the socket
code.

## Fallback host: Render

The API is a plain Docker web service, so Render works with dashboard
configuration too — no file needed (the former `render.yaml` blueprint was
removed in favour of this document, since Railway is now the primary). Enter:
Docker build context `backend` (or root directory `backend`), healthcheck path
`/health`, and the same variables. Differences to weigh: Render's free plan
**spins down after ~15 minutes idle** (tens of seconds to wake) and has **no
persistent disk**, so avatars are wiped on every deploy. Fly.io is a third
option with the same "it's just a Dockerfile" shape.

## Before you make it public

* Rotate `JWT_SECRET_KEY`, the Neon password and the Gmail app password — the
  values currently in `backend/.env` are still the old ones (that file is
  gitignored and never committed).
* Run a full-history scan and close the outstanding items in
  [`GITGUARDIAN_REMEDIATION_HANDOFF.md`](GITGUARDIAN_REMEDIATION_HANDOFF.md):
  a full-history secret scan, the three GitHub-only commits GitGuardian still
  sees, and the legacy GitLab token check.
* Read [`SECURITY_AND_DEPLOYMENT_REVIEW.md`](SECURITY_AND_DEPLOYMENT_REVIEW.md)
  and work the P1/P2 list.

## Rollback

* **Railway** — Deployments → pick the previous successful deploy → *Redeploy*
  (or *Remove* the deployment). Because the image holds no credential, a
  rollback is code only; rotating a secret is a variable change, not a rebuild.
* **Vercel** — Deployments → pick the last good one → *Promote to Production*.
