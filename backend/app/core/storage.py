"""Where uploaded files live, and whether that location actually works.

Avatars are the only state this API keeps outside the database, which makes them
the only thing a redeploy can destroy: a container filesystem is ephemeral, so
every deploy wipes it unless a volume is mounted over the directory.

Two small things therefore live here, both aimed at that failure being *quiet*:

  * one resolved uploads path, overridable through ``UPLOADS_DIR``, so a volume
    mounted somewhere else on a host needs a variable rather than a rebuild;
  * a startup check that creates the tree and proves a file can be written to it.

The check matters because of how the failure actually presents. Railway mounts
volumes as root, so a service whose app runs as an unprivileged user boots
normally, serves ``/health``, answers every API call correctly — and then fails
on the first avatar upload, long after the deploy that caused it. The same is
true of a volume mounted at the wrong path. See DEPLOY.md, "Uploads survive
redeploys".
"""
import logging
import os

log = logging.getLogger(__name__)

# The variable the container entrypoint (backend/docker-entrypoint.sh) also
# reads to decide which directory to chown. Both default to the same path, and
# they must keep agreeing.
ENV_VAR = "UPLOADS_DIR"

# Mirrors the image layout: this file is backend/app/core/storage.py, so three
# levels up is backend/ — locally backend/uploads/, in the container /app/uploads.
# That is the directory the Dockerfile creates, the one compose mounts a volume
# on, and the one Railway's volume should be mounted at.
DEFAULT_UPLOADS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
)


def uploads_root() -> str:
    """Absolute path served at /uploads.

    Read on every call rather than cached at import time, so setting the
    variable (in a container, or in a test) is enough to move the tree — and so
    a blank value falls back to the default instead of writing to "/".
    """
    configured = (os.getenv(ENV_VAR) or "").strip()
    if configured:
        return os.path.abspath(configured)
    return DEFAULT_UPLOADS_DIR


def avatars_dir() -> str:
    """Directory avatar files are written to; served at /uploads/avatars."""
    return os.path.join(uploads_root(), "avatars")


def ensure_uploads_ready() -> tuple[bool, str]:
    """Create the uploads tree and prove a file can be written into it.

    Returns ``(True, root)`` or ``(False, reason)``; the reason is written for
    an operator reading a deploy log, not for a user. Never raises.

    Deliberately does not stop the process: an unwritable uploads directory
    breaks one feature, and taking the whole API — analytics, database, every
    other endpoint — down over it would be a worse failure than the one being
    reported. The caller logs the reason.
    """
    root = uploads_root()
    try:
        os.makedirs(avatars_dir(), exist_ok=True)
    except OSError as exc:
        return False, f"cannot create {root}: {exc}"

    # Probe what will actually happen on an upload: makedirs(exist_ok=True)
    # succeeds on a directory that merely *exists*, which is exactly the case a
    # root-owned volume produces, so existence is not evidence of writability.
    probe = os.path.join(root, ".write-probe")
    try:
        with open(probe, "w", encoding="utf-8") as fh:
            fh.write("ok")
    except OSError as exc:
        return False, f"{root} is not writable: {exc}"
    finally:
        try:
            os.remove(probe)
        except OSError:
            pass
    return True, root
