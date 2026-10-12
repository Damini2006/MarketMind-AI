"""Uploads storage: where the tree lives, and what happens when it is broken.

Avatars are the only state this API keeps outside the database, which makes them
the only thing a redeploy can destroy. That is why a deployment mounts a volume
over one directory, and why both halves of that contract — the container
entrypoint that chowns it and the app that writes to it — read the same variable.

These tests pin the Python half: the resolved path, the UPLOADS_DIR override, and
that a broken location is *reported* rather than raised, because the API has to
keep serving analytics and every other endpoint even when uploads cannot work.
"""
import os

from app.core import storage

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_default_path_is_uploads_next_to_the_app(monkeypatch):
    """backend/uploads locally, /app/uploads in the image — the directory the
    Dockerfile creates, that compose mounts a volume on, and that Railway's
    volume should be mounted at."""
    monkeypatch.delenv(storage.ENV_VAR, raising=False)
    expected = os.path.abspath(
        os.path.join(os.path.dirname(storage.__file__), "..", "..", "uploads")
    )
    assert storage.uploads_root() == expected
    assert os.path.isabs(storage.uploads_root())


def test_uploads_dir_env_var_moves_the_tree(tmp_path, monkeypatch):
    monkeypatch.setenv(storage.ENV_VAR, str(tmp_path / "volume"))
    assert storage.uploads_root() == str(tmp_path / "volume")
    assert storage.avatars_dir() == str(tmp_path / "volume" / "avatars")


def test_blank_env_var_falls_back_to_the_default(monkeypatch):
    """A set-but-empty variable must not resolve to the working directory."""
    monkeypatch.setenv(storage.ENV_VAR, "   ")
    assert storage.uploads_root() == storage.DEFAULT_UPLOADS_DIR


def test_ready_check_creates_the_tree_and_leaves_no_probe(tmp_path, monkeypatch):
    root = tmp_path / "volume"
    monkeypatch.setenv(storage.ENV_VAR, str(root))

    ok, detail = storage.ensure_uploads_ready()

    assert ok is True
    assert detail == str(root)
    assert os.path.isdir(storage.avatars_dir())
    # The write probe is removed again, so the volume holds nothing but uploads.
    assert os.listdir(root) == ["avatars"]


def test_ready_check_reports_an_unusable_location_without_raising(tmp_path, monkeypatch):
    """A path that cannot exist (its parent is a regular file) is the "volume is
    not mounted where the app expects it" case. It must come back as a value the
    caller can log, not as an exception during startup."""
    blocker = tmp_path / "not-a-dir"
    blocker.write_text("x", encoding="utf-8")
    monkeypatch.setenv(storage.ENV_VAR, str(blocker / "uploads"))

    ok, detail = storage.ensure_uploads_ready()

    assert ok is False
    assert str(blocker) in detail


def test_avatar_upload_writes_to_the_configured_volume(client, owner_headers, tmp_path, monkeypatch):
    """The endpoint and the deployment must agree on one directory: point
    UPLOADS_DIR at a temp directory and the uploaded file has to land in it."""
    monkeypatch.setenv(storage.ENV_VAR, str(tmp_path))

    res = client.post(
        "/api/users/avatar",
        files={"file": ("avatar.png", _PNG, "image/png")},
        headers=owner_headers,
    )

    assert res.status_code == 200, res.text
    url = res.json()["avatar_url"]
    assert url.startswith("/uploads/avatars/")
    written = tmp_path / "avatars" / os.path.basename(url)
    assert written.read_bytes() == _PNG


def test_avatar_upload_reports_unwritable_storage_as_503(client, owner_headers, tmp_path, monkeypatch):
    """A volume the app cannot write to is a deployment problem: the client gets
    a 503 naming it, not an opaque 500 from a raw OSError."""
    blocker = tmp_path / "not-a-dir"
    blocker.write_text("x", encoding="utf-8")
    monkeypatch.setenv(storage.ENV_VAR, str(blocker / "uploads"))

    res = client.post(
        "/api/users/avatar",
        files={"file": ("avatar.png", _PNG, "image/png")},
        headers=owner_headers,
    )

    assert res.status_code == 503, res.text
    assert "not writable" in res.json()["detail"]
