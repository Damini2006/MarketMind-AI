"""Tests for app/resilience.py and its wiring into the background tasks.

The point of the module is to make two *transient* Neon failure modes — an
intermittent resolver ("Name or service not known") and a dropped serverless
socket ("SSL SYSCALL error: EOF detected") — survive a retry, while a real bug
(bad SQL, a constraint violation) still surfaces immediately. These tests pin
BOTH halves of that contract: retry the transient, never retry the real error.
"""
import socket

import pytest
import sqlalchemy.exc as sa_exc

from app import resilience


# ── helpers ──────────────────────────────────────────────────────────────


def _wrapped(exc_type, message):
    """A SQLAlchemy error wrapping a driver error, as psycopg2 surfaces them."""
    return exc_type("SELECT 1", {}, Exception(message))


class _Recorder:
    """Captures log records without touching the real logging tree."""

    def __init__(self):
        self.records = []

    def log(self, level, msg, exc_info=None):
        self.records.append((level, msg))

    @property
    def messages(self):
        return [m for _, m in self.records]


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    """Never sleep for real: swap the module's sleep indirection for a no-op."""
    slept = []
    monkeypatch.setattr(resilience, "_SLEEP", lambda s: slept.append(s))
    monkeypatch.setattr(resilience, "_throttle_state", {})
    yield slept
    resilience.reset_throttle()


# ── is_transient_db_error ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "message",
    [
        "could not translate host name \"ep-x.neon.tech\" to address: Name or service not known",
        "No address associated with hostname",
        "SSL SYSCALL error: EOF detected",
        "server closed the connection unexpectedly",
        "connection reset by peer",
        "the database system is starting up",
    ],
)
def test_transient_markers_are_recognised(message):
    assert resilience.is_transient_db_error(_wrapped(sa_exc.OperationalError, message))


def test_disconnection_error_is_transient_regardless_of_message():
    assert resilience.is_transient_db_error(sa_exc.DisconnectionError("boom"))


def test_bare_resolver_error_is_transient():
    # socket.gaierror is what the container resolver raises directly.
    assert resilience.is_transient_db_error(socket.gaierror(-2, "Name or service not known"))


def test_connection_reset_is_transient():
    assert resilience.is_transient_db_error(ConnectionResetError("connection reset by peer"))


def test_integrity_error_is_not_transient():
    """A duplicate key is a real error: retrying just burns time and hides it."""
    err = _wrapped(sa_exc.IntegrityError, 'duplicate key value violates unique constraint "users_email_key"')
    assert not resilience.is_transient_db_error(err)


def test_programming_error_is_not_transient():
    err = _wrapped(sa_exc.ProgrammingError, 'column "nope" does not exist')
    assert not resilience.is_transient_db_error(err)


def test_non_database_error_is_not_transient_even_with_a_connectivity_word():
    """A stray 'connection refused' from, say, SMTP must not be classified as DB."""
    assert not resilience.is_transient_db_error(ValueError("connection refused"))


def test_self_referencing_chain_does_not_hang():
    err = sa_exc.OperationalError("SELECT 1", {}, Exception("could not translate host name"))
    err.__context__ = err  # pathological cycle
    assert resilience.is_transient_db_error(err) is True


# ── call_with_retry ──────────────────────────────────────────────────────


def test_retries_transient_failure_then_succeeds(_no_real_sleep):
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise _wrapped(sa_exc.OperationalError, "SSL SYSCALL error: EOF detected")
        return "ok"

    assert resilience.call_with_retry(flaky, attempts=5, base_delay=0.01) == "ok"
    assert calls["n"] == 3
    assert len(_no_real_sleep) == 2  # slept between the two failures


def test_does_not_retry_a_non_transient_error(_no_real_sleep):
    calls = {"n": 0}

    def broken():
        calls["n"] += 1
        raise _wrapped(sa_exc.IntegrityError, "duplicate key value violates unique constraint")

    with pytest.raises(sa_exc.IntegrityError):
        resilience.call_with_retry(broken, attempts=5, base_delay=0.01)
    assert calls["n"] == 1  # tried once, did not retry
    assert _no_real_sleep == []


def test_exhausting_attempts_reraises_the_last_transient_error(_no_real_sleep):
    calls = {"n": 0}

    def always_down():
        calls["n"] += 1
        raise _wrapped(sa_exc.OperationalError, "could not translate host name \"x\" to address")

    with pytest.raises(sa_exc.OperationalError):
        resilience.call_with_retry(always_down, attempts=3, base_delay=0.01)
    assert calls["n"] == 3
    assert len(_no_real_sleep) == 2  # backoff between attempts, not after the last


def test_on_retry_hook_is_invoked_with_the_attempt_number(_no_real_sleep):
    seen = []

    def flaky():
        raise _wrapped(sa_exc.OperationalError, "eof detected")

    with pytest.raises(sa_exc.OperationalError):
        resilience.call_with_retry(
            flaky, attempts=3, base_delay=0.01, on_retry=lambda a, e, d: seen.append(a)
        )
    assert seen == [1, 2]


def test_retry_db_decorator_preserves_metadata_and_retries(_no_real_sleep):
    state = {"n": 0}

    @resilience.retry_db(attempts=4, base_delay=0.01)
    def fetch():
        """docstring survives"""
        state["n"] += 1
        if state["n"] == 1:
            raise _wrapped(sa_exc.OperationalError, "server closed the connection unexpectedly")
        return 42

    assert fetch() == 42
    assert fetch.__name__ == "fetch"
    assert fetch.__doc__ == "docstring survives"


# ── backoff_delay ────────────────────────────────────────────────────────


def test_backoff_grows_exponentially_and_is_capped():
    d1 = resilience.backoff_delay(1, base_delay=1.0, max_delay=100.0)
    d2 = resilience.backoff_delay(2, base_delay=1.0, max_delay=100.0)
    d9 = resilience.backoff_delay(9, base_delay=1.0, max_delay=100.0)
    assert 1.0 <= d1 <= 1.25
    assert 2.0 <= d2 <= 2.5
    assert 100.0 <= d9 <= 125.0  # capped, plus at most 25% jitter


def test_backoff_is_zero_when_base_is_zero():
    assert resilience.backoff_delay(5, base_delay=0.0, max_delay=100.0) == 0.0


# ── log_throttled ────────────────────────────────────────────────────────


def test_log_throttled_emits_first_then_suppresses_and_reports(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(resilience.time, "monotonic", lambda: clock[0])
    logger = _Recorder()

    assert resilience.log_throttled(logger, "k", "boom", min_interval=60.0) is True
    clock[0] = 1010.0
    assert resilience.log_throttled(logger, "k", "boom", min_interval=60.0) is False
    clock[0] = 1020.0
    assert resilience.log_throttled(logger, "k", "boom", min_interval=60.0) is False
    clock[0] = 1070.0
    assert resilience.log_throttled(logger, "k", "boom", min_interval=60.0) is True

    assert len(logger.messages) == 2
    assert logger.messages[0] == "boom"
    assert "2 similar suppressed" in logger.messages[1]


def test_log_throttled_keys_are_independent(monkeypatch):
    clock = [500.0]
    monkeypatch.setattr(resilience.time, "monotonic", lambda: clock[0])
    logger = _Recorder()

    assert resilience.log_throttled(logger, "a", "A", min_interval=60.0) is True
    assert resilience.log_throttled(logger, "b", "B", min_interval=60.0) is True
    assert logger.messages == ["A", "B"]


# ── wiring: the background tasks actually use the retry helper ───────────


def test_keepalive_ping_retries_a_transient_failure(monkeypatch):
    """main._ping must survive a transient failure instead of dying on it."""
    from app import main

    state = {"n": 0}

    def flaky_once():
        state["n"] += 1
        if state["n"] < 2:
            raise _wrapped(sa_exc.OperationalError, "SSL SYSCALL error: EOF detected")

    monkeypatch.setattr(main, "_ping_once", flaky_once)
    main._ping()  # must not raise
    assert state["n"] == 2


def test_notification_sync_retries_and_throttles_failures(monkeypatch):
    """The background sync retries a transient error and stops spamming."""
    from app.routers import notifications

    calls = {"n": 0}

    class _FakeSession:
        def close(self):
            pass

    def flaky_sync(db, business_id):
        calls["n"] += 1
        if calls["n"] == 1:
            raise _wrapped(sa_exc.OperationalError, "could not translate host name \"x\"")

    monkeypatch.setattr(notifications, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(notifications, "_do_sync_notifications", flaky_sync)

    notifications._run_sync_in_background(999)
    assert calls["n"] == 2  # retried once, then succeeded


def test_notification_sync_gives_up_quietly_on_a_real_error(monkeypatch):
    from app.routers import notifications

    calls = {"n": 0}

    class _FakeSession:
        def close(self):
            pass

    def broken(db, business_id):
        calls["n"] += 1
        raise _wrapped(sa_exc.ProgrammingError, 'column "nope" does not exist')

    monkeypatch.setattr(notifications, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(notifications, "_do_sync_notifications", broken)

    # Must not raise, and must not retry a non-transient error.
    notifications._run_sync_in_background(998)
    assert calls["n"] == 1
