"""Production-mode guards.

These cover the switches that separate "convenient while developing" from
"safe to expose to the internet":

  - `ENVIRONMENT=production` is recognised (and a typo is NOT production);
  - a wildcard CORS origin is refused, because credentials are allowed;
  - the demo tenant -- whose account passwords are published in this repo --
    is not seeded in production.

The JWT-secret startup guard is enforced at import time, so it is exercised by
running the module in a subprocess rather than through a fixture.
"""
import os
import subprocess
import sys
import pathlib

import pytest

from app.core.env import is_production, parse_cors_origins
from app.seed_data import _demo_seeding_enabled


class TestEnvironmentDetection:
    @pytest.mark.parametrize("value", ["production", "PRODUCTION", " prod "])
    def test_production_aliases(self, monkeypatch, value):
        monkeypatch.setenv("ENVIRONMENT", value)
        monkeypatch.delenv("APP_ENV", raising=False)
        assert is_production() is True

    @pytest.mark.parametrize("value", ["development", "dev", "test", "ci", "staging", "prodcution"])
    def test_everything_else_is_not_production(self, monkeypatch, value):
        monkeypatch.setenv("ENVIRONMENT", value)
        monkeypatch.delenv("APP_ENV", raising=False)
        assert is_production() is False

    def test_app_env_is_an_alias(self, monkeypatch):
        monkeypatch.delenv("ENVIRONMENT", raising=False)
        monkeypatch.setenv("APP_ENV", "production")
        assert is_production() is True


class TestCorsOrigins:
    def test_plain_list(self):
        origins, wildcard = parse_cors_origins("https://app.example.com,https://www.example.com")
        assert origins == ["https://app.example.com", "https://www.example.com"]
        assert wildcard is False

    def test_wildcard_is_dropped_and_reported(self):
        origins, wildcard = parse_cors_origins("*")
        assert origins == []
        assert wildcard is True

    def test_wildcard_mixed_with_real_origins(self):
        origins, wildcard = parse_cors_origins("https://app.example.com,*")
        assert origins == ["https://app.example.com"]
        assert wildcard is True

    def test_whitespace_and_empty_entries(self):
        origins, wildcard = parse_cors_origins(" https://app.example.com , ,")
        assert origins == ["https://app.example.com"]
        assert wildcard is False


class TestDemoSeeding:
    def test_on_outside_production(self, monkeypatch):
        monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
        monkeypatch.setenv("ENVIRONMENT", "development")
        assert _demo_seeding_enabled() is True

    def test_off_in_production(self, monkeypatch):
        monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
        monkeypatch.setenv("ENVIRONMENT", "production")
        assert _demo_seeding_enabled() is False

    def test_explicit_override_wins(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SEED_DEMO_DATA", "true")
        assert _demo_seeding_enabled() is True


class TestJwtSecretGuard:
    """`core.security` fails fast in production instead of inventing a key."""

    _SNIPPET = "import app.core.security as s; print('started', len(s.SECRET_KEY))"

    def _run(self, **env):
        backend = pathlib.Path(__file__).resolve().parents[1]
        base = {
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "PYTHONPATH": str(backend),
            # Any DATABASE_URL satisfies config; security.py never connects.
            "DATABASE_URL": "sqlite:///./unused-for-this-check.db",
            "ENVIRONMENT": "production",
        }
        base.update(env)
        return subprocess.run(
            [sys.executable, "-c", self._SNIPPET],
            cwd=str(backend),
            env=base,
            capture_output=True,
            text=True,
        )

    def test_missing_secret_refuses_to_start(self):
        res = self._run(JWT_SECRET_KEY="")
        assert res.returncode != 0
        assert "JWT_SECRET_KEY is not set" in res.stderr

    def test_placeholder_secret_refuses_to_start(self):
        res = self._run(JWT_SECRET_KEY="your-random-secret-min-32-chars")
        assert res.returncode != 0
        assert "placeholder" in res.stderr

    def test_short_secret_refuses_to_start(self):
        res = self._run(JWT_SECRET_KEY="only-31-characters-long-secret")
        assert res.returncode != 0
        assert ">= 32" in res.stderr

    def test_strong_secret_starts(self):
        res = self._run(JWT_SECRET_KEY="A" * 48)
        assert res.returncode == 0, res.stderr
        assert "started 48" in res.stdout
