"""Shared guards for user-uploaded files (CSV imports, avatars).

Every upload path goes through one of these helpers so a single request
can neither exhaust memory with an oversized body nor plant a file whose
content disagrees with its claimed type.
"""
from fastapi import HTTPException, UploadFile

# 10 MB — generous for bulk imports, small enough that a malicious upload
# cannot meaningfully dent memory before the cap fires.
MAX_CSV_BYTES = 10 * 1024 * 1024
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # keep in sync with users.MAX_AVATAR_SIZE

# Magic-byte signatures for the image types avatars may use. Content-Type
# headers are client-controlled and cannot be trusted on their own.
_IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def sniff_image_type(data: bytes):
    """Return the image MIME type the bytes actually are, or None."""
    for signature, mime in _IMAGE_SIGNATURES:
        if data.startswith(signature):
            return mime
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def read_upload_capped(file: UploadFile, max_bytes: int = MAX_CSV_BYTES) -> bytes:
    """Read an UploadFile enforcing max_bytes; 413 on overflow, 400 on empty.

    Reads in bounded chunks so the limit is enforced DURING streaming — a
    2 GB body never lands in memory (the old `file.file.read()` read it all).
    """
    max_bytes = max_bytes or MAX_CSV_BYTES
    total = 0
    chunks = []
    while True:
        chunk = file.file.read(512 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {max_bytes // (1024 * 1024)} MB upload limit.",
            )
        chunks.append(chunk)
    raw = b"".join(chunks)
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    return raw


def read_csv_upload(file: UploadFile, max_bytes: int = None) -> bytes:
    """Validate the .csv extension and size cap, returning the raw bytes.

    max_bytes is resolved at CALL time (not def time) so tests can monkeypatch
    MAX_CSV_BYTES to exercise the cap with tiny payloads.
    """
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")
    return read_upload_capped(file, max_bytes if max_bytes is not None else MAX_CSV_BYTES)
