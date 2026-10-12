#!/bin/sh
# Fix ownership of the uploads directory, then hand the app back to the
# unprivileged runtime user.
#
# Why this exists: platforms mount a volume as root, while this image runs the
# app as `appuser` (uid 1000). A root-owned mount is readable but not writable by
# uid 1000, so avatar uploads fail on exactly the deployment a volume was added
# to fix. Railway documents the situation and suggests setting
# RAILWAY_RUN_UID=0, which runs the *whole service* as root; we set it only to
# reach this script as root, chown the mount, and then drop the app back to
# uid 1000. The running application is never root.
#
# Everywhere else this is a no-op: compose and `docker run` start the container
# as appuser already (Dockerfile `USER appuser`), the ownership of a fresh volume
# is inherited from the image's /app/uploads, and `id -u` is not 0 — so the
# script just execs the command.
#
# UPLOADS_DIR must match core/storage.py's default; both resolve to
# /app/uploads in this image.
set -eu

UPLOADS="${UPLOADS_DIR:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS" 2>/dev/null || true

  # Skip the recursive walk when the top level is already ours — the steady
  # state after the first boot, so a directory full of avatars is not re-walked
  # on every restart.
  current_owner="$(stat -c '%u:%g' "$UPLOADS" 2>/dev/null || echo '')"
  if [ "$current_owner" != "1000:1000" ]; then
    if chown -R appuser:appuser "$UPLOADS" 2>/dev/null; then
      echo "[entrypoint] chowned $UPLOADS to appuser (uid 1000)"
    else
      # Do not abort: an unwritable uploads directory must not take down the
      # whole API. app/core/storage.py will report the same problem at startup,
      # and it is visible in the deploy log here too.
      echo "[entrypoint] WARNING: could not chown $UPLOADS - uploads will fail" >&2
    fi
  fi

  exec gosu appuser "$@"
fi

exec "$@"
