# Backend image.
#
# Three kinds of thing, deliberately kept apart:
#
#   committed artifacts (baked in at build time)
#       application code, alembic/ + alembic.ini (migrations run at startup),
#       app/trained_models/*.pkl if present — NOT tracked in git (.gitignore
#       excludes them), so a fresh clone bakes in no model and
#       /api/revenue/predict answers with engine="heuristic". See DEPLOY.md.
#       Copying a large model in here is a deliberate, separate deployment step.
#   runtime config (injected at start, NEVER baked in)
#       DATABASE_URL, JWT_SECRET_KEY, CORS_ORIGINS ... supplied by compose's
#       `env_file:` (see BACKEND_ENV_FILE in docker-compose.yml) or by the host
#       platform's environment. .dockerignore excludes .env and .env.* so no
#       credential can be COPYd in — a rebuild is not a rotation.
#   runtime state (a volume, never in the image)
#       uploads/ avatars, backed by the backend_uploads named volume.
#
# Consequence worth knowing: because no .env is in the image, a container
# started with `docker run` and no environment exits immediately with
# "[config] DATABASE_URL is not set" rather than silently using a stale secret.

FROM python:3.11-slim

# Streams logs instead of buffering them, and keeps the interpreter from writing
# __pycache__: the app runs as a non-root user that only needs to write uploads/.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# curl is the only runtime system package: the compose healthcheck calls it.
# No compiler and no libpq headers — every dependency installs from a wheel
# (psycopg2-binary bundles its own libpq), so gcc/libpq-dev only grew the image
# and widened the attack surface.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Dependencies before source, so editing application code does not invalidate
# the pip install layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Unprivileged runtime user. Only uploads/ is chowned: chowning all of /app
# would duplicate the multi-hundred-megabyte tree into a new image layer, and
# nothing else needs to be writable (the code is world-readable as shipped).
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid 1000 --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p uploads \
    && chown appuser:appuser uploads

USER appuser

EXPOSE 8000

# The port to bind. Compose and CI leave this unset and publish 8000, while
# most PaaS Docker hosts — Railway and Render both do — inject the port they route to as
# PORT. Defaulting to 8000 keeps compose/CI exactly as they were and lets such
# a host override it without needing a host-specific start command.
ENV PORT=8000

# Overridden by the compose healthcheck (same probe), but keeps the image
# self-describing when run standalone. Shell form, so ${PORT} expands and the
# curl exit status is the health result (the exec form cannot express
# `|| exit 1`).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -f "http://localhost:${PORT}/health" || exit 1

# Shell form so ${PORT} is expanded when the container starts; the exec form
# would pass the literal string "${PORT}". Falls back to the ENV default above.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port \"${PORT}\""]
