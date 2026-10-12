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
backend/Dockerfile              # changed — binds $PORT, and now starts via an entrypoint
backend/docker-entrypoint.sh    # new — chowns a root-mounted uploads volume, then
                                #       drops to appuser; no-op elsewhere
backend/app/core/storage.py     # new — the uploads path (UPLOADS_DIR) + a startup
                                #       write check, so a broken volume is visible
.gitattributes                  # changed — keeps those shell scripts LF everywhere
frontend/vercel.json            # new — static build + SPA rewrites
scripts/verify_port.sh          # new — proves the $PORT contract locally
DEPLOY.md                       # this file
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

The same applies to the uploads volume in step 3: no file in the repo can declare
one (a volume is attached to a service and mounted when a container starts, not
baked into an image), so it is created once in the dashboard or with `railway
volume add`. Everything that *can* be code — the mount path the app expects,
`UPLOADS_DIR`, and the ownership fix the entrypoint performs — is in the repo.

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

### Uploads survive redeploys — attach a volume

Avatars are the only state this API keeps outside the database, and a container
filesystem is wiped on every deploy. Without a volume the `avatar_url` rows in
Neon survive while the files they point at do not, so every avatar 404s after a
redeploy — quietly, until someone opens their own profile.

Railway → service → **Volumes** → *New volume*, mount path **`/app/uploads`**.
With the CLI, the same thing:

```bash
railway volume add --service <service> --mount-path /app/uploads
```

**Set `RAILWAY_RUN_UID=0` on the service as well.** Railway mounts volumes as
root, and this image deliberately runs the application as a non-root user
(`appuser`, uid 1000), which cannot write to a root-owned mount.
`RAILWAY_RUN_UID=0` makes the container *start* as root, which is all
[`docker-entrypoint.sh`](backend/docker-entrypoint.sh) needs: it chowns the mount
to `appuser` and then execs the app through `gosu`, so the running application is
never root. Railway's own advice for this is to run the entire service as root;
this uses the same switch for one chown and one privilege drop.

Four things worth knowing about the path and the volume:

* **`/app/uploads` is the app's own path, not a guess.**
  [`core/storage.py`](backend/app/core/storage.py) derives the default from its own
  file location, which is `/app/uploads` inside the image, and that is the same
  directory [`docker-compose.yml`](docker-compose.yml) mounts locally. If the
  volume has to live somewhere else, set `UPLOADS_DIR` — the entrypoint chowns
  the same variable, so app and entrypoint cannot drift apart.
* **A volume is not an overlay.** Nothing already in the image at that path
  appears on it, and build-time writes to it do not persist; the app creates the
  tree itself at startup.
* **One volume per service**, a service with a volume **cannot run replicas**,
  and redeploys have a brief downtime instead of the usual zero-downtime
  rollout. Size defaults to 0.5 GB on Free/Trial and 5 GB on Hobby (live
  resizable on paid plans) — far more than avatars need.
* **Writes are checked, not assumed.** `app/main.py` creates the tree and probes
  a real write at startup, logging
  `Uploads are NOT usable: <path>: <error>` when that fails, and
  `POST /api/users/avatar` answers **503** ("Avatar storage is not writable on
  this deployment.") rather than an opaque 500. That log line is the only place
  the failure is visible — a missing `RAILWAY_RUN_UID=0` otherwise looks like a
  perfectly healthy service whose avatars silently do not persist.

Verify it before trusting it:

```bash
# 1. upload an avatar as a real account, then fetch the URL it returned
curl -sI https://<something>.up.railway.app/uploads/avatars/<file>.png | head -1
# HTTP/2 200
# 2. redeploy the service, repeat step 1: it must still be 200
railway volume files list /
```

A 404 on step 1 means the volume is mounted somewhere the app is not writing
(`UPLOADS_DIR` mismatch); a failed *upload* means the mount is not writable and
the startup log names why.

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

### The gate that keeps checking: post-deploy smoke

[`scripts/post_deploy_smoke.py`](scripts/post_deploy_smoke.py), run by
[`.github/workflows/post-deploy-smoke.yml`](.github/workflows/post-deploy-smoke.yml),
checks the **public** URL on every push to the production branch — the one thing
the manual run above cannot. It builds the frontend and compares the
content-hashed entry bundle with the one the deployment serves, then probes
`/api/sales/` to catch the SPA fallback answering API paths with HTML. Both were
real failures here: one domain served a 23-hour-old build, and another answered
`/api/...` with the SPA document while every status code looked healthy.

It then logs in as a **read-only demo account** and asserts the data behind the
two browser-computed analysis pages really loads, through the same `/api`
rewrite the app uses:

* **Compare Periods** — `/api/sales/`, `/api/invoices/`, `/api/inventory/products`
* **Funnel Analysis** — `/api/customers/`, `/api/sales/`, `/api/inventory/products`

Neither page has an endpoint of its own; both compute their analysis in the
browser, so a non-empty list per path is what "the page works" means — a payload
the frontend's own `toList()` would render as an empty page is a failure here.
The account must also be *refused* (403) by a write endpoint it has no business
calling, so credentials that turn out to belong to a second owner fail the run
instead of passing quietly.

Two **repository secrets** are needed for that part:

| Secret | Value |
|---|---|
| `POST_DEPLOY_DEMO_EMAIL` | a restricted account — not an owner or admin — on a tenant **with data** |
| `POST_DEPLOY_DEMO_PASSWORD` | its password |

Production does not seed the demo accounts (`ENVIRONMENT=production` turns
seeding off), so these have to be real credentials: invite a `sales_executive`
into your own business and use that. Both are secrets rather than variables — the
password is a credential. With neither set, the authenticated checks are
**skipped** with a `::warning::` annotation on the run instead of failing the
deploy (visible in the run, never counted as a pass); setting only one of the two
fails the run, because that is a misconfigured secret rather than an absent one.

To run it by hand against a deployment:

```bash
cd frontend && npm ci && npm run build
bundle="$(grep -oE '/assets/index-[^\"]+\.js' dist/index.html | head -1)"

POST_DEPLOY_DEMO_EMAIL=<the account> POST_DEPLOY_DEMO_PASSWORD=<its password> \
python3 ../scripts/post_deploy_smoke.py \
  --url https://<your-app>.vercel.app --expected-bundle "$bundle"
```

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

## AI features on a fresh deploy

Only the revenue forecast depends on a model file, and that file is not in git
(`.gitignore` excludes `backend/app/trained_models/*.pkl`), so the Railway
service starts without it and behaves like this:

* `POST /api/revenue/predict` and `POST /api/revenue/explain` answer from a
  built-in heuristic. Both responses carry `"engine": "heuristic"` instead of
  `"model"`, the first call logs a warning naming the path it wanted, and the
  Revenue Prediction page shows an amber **Heuristic — no model file** badge.
* Every other AI endpoint (`/api/ai/forecast`, `/forecasting`, `/segmentation`,
  `/churn`, `/churn/features`, `/recommendations`, `/recommendations/cross-sell`,
  `/anomalies`, `/clv`, `/chat`) fits its scikit-learn model in-process from the
  database and reads no `.pkl`, so none of them change.

Measured on this input — Electronics / North / Summer, demand 120, price 80,
promotion Yes — the heuristic returns **11520.00** while the trained model
returns **8051.89**. The fallback overstates revenue by roughly 43% on that
row, so never present fallback numbers as model output.

To give the service the model, mount a volume (or bake a layer) holding
`revenue_prediction_compressed.pkl` at **`/app/app/trained_models/`** — note the
repeated `app`, because the loader resolves the path relative to
`backend/app/ml/inference.py`, not to the working directory. The file is about
112 MB compressed and 551 MB raw, which is why it is not in git.
`compress_models.py` writes `models/revenue_prediction_compressed.pkl`, not this
path, so its output has to be moved.

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
| `UPLOADS_DIR` | no | absolute path served at `/uploads`; default `/app/uploads`. Set it only when the volume is mounted elsewhere — the container entrypoint reads the same variable |
| `RAILWAY_RUN_UID` | yes on Railway | `0`, so the entrypoint can chown a root-mounted volume before dropping to `appuser`. See "Uploads survive redeploys" |

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
