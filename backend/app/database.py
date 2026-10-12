import logging
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

from .resilience import log_throttled, resolve_host

log = logging.getLogger(__name__)

# DATABASE_URL is REQUIRED. No silent fallback to a local SQLite file: that
# fallback made the app quietly create/point at ./marketmind.db whenever .env
# was missing or incomplete, which looked like "the database lost my account".
# Fail fast instead.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.stderr.write(
        "\n[config] DATABASE_URL is not set.\n"
        "[config] Add it to backend/.env, e.g.\n"
        "[config]   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require\n\n"
    )
    raise SystemExit(1)

IS_POSTGRES = DATABASE_URL.startswith("postgresql")
connect_args = {"check_same_thread": False} if not IS_POSTGRES else {}

if IS_POSTGRES:
    # Neon (serverless PostgreSQL) tuning.
    #
    # Connect through the DIRECT endpoint, not the `-pooler` one. Measured
    # from inside the container, both endpoints cost ~5s per fresh connection
    # (dominated by round-trip latency to us-east-2, not by the pooler), so the
    # pooler buys nothing here — and this process is a single long-lived server
    # with its own SQLAlchemy pool, which is the case the pooler is NOT for.
    # Going direct removes PgBouncer's transaction-mode caveats (no server-side
    # prepared statements, advisory locks or LISTEN/NOTIFY) and one more DNS
    # name that can fail to resolve.
    #
    #  - connect_timeout: fail fast instead of hanging when compute is cold
    #  - keepalives: a Neon compute that suspends (or a NAT that drops the
    #    mapping) leaves a half-open socket the OS would not otherwise notice
    #    for minutes; TCP keepalive surfaces it in ~30s so pool_pre_ping and
    #    the retry layer can act on a real error instead of stalling.
    #  - pool_pre_ping: drop dead connections Neon has recycled (free tier
    #    suspends idle compute, which kills pooled connections). Costs one
    #    round trip per checkout; worth it over this link.
    #  - pool_recycle: refresh connections before Neon's 5-min idle timeout
    #  - pool_use_lifo: hand back the most recently used connection first, so
    #    idle ones age out via pool_recycle instead of pinning Neon compute.
    # The driver options live here rather than in connect_args, because this
    # engine supplies a `creator`: SQLAlchemy calls it with no arguments, so
    # everything libpq needs has to be assembled on our side. See _connect.
    _url = make_url(DATABASE_URL)
    _LIBPQ_ARGS = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

    def _connect():
        """Open one psycopg2 connection, resolving the Neon host ourselves.

        libpq resolves the host itself, in C, where the container's embedded
        resolver can fail the lookup and no Python-level retry can reach it
        (see the resolver notes in resilience.py). Passing a numeric
        ``hostaddr`` removes that lookup from the connection path entirely;
        ``host`` still rides along as the TLS SNI name Neon routes on.

        Resolving here, per physical connection, rather than once at startup is
        what keeps a Neon failover survivable: the address is re-read on every
        new pooled connection instead of being frozen for the process lifetime.
        """
        import psycopg2  # local: database.py only needs it on the postgres path

        params = dict(_url.query)
        if _url.username:
            params["user"] = _url.username
        if _url.password:
            params["password"] = _url.password
        if _url.database:
            params["dbname"] = _url.database
        if _url.host:
            params["host"] = _url.host
        if _url.port:
            params["port"] = _url.port
        params.update(_LIBPQ_ARGS)

        if _url.host:
            try:
                infos = resolve_host(_url.host, _url.port or 5432)
            except Exception as exc:  # noqa: BLE001 - degrade, do not fail here
                # Resolver down and nothing cached. Fall back to letting libpq
                # do its own lookup: worse, but only as bad as the old behaviour,
                # whereas raising would turn a DNS blip into a dead connection.
                log_throttled(
                    log,
                    "dns-prefetch-fallback",
                    f"could not pre-resolve {_url.host} ({type(exc).__name__}: {exc}); "
                    "letting libpq resolve it",
                    min_interval=60.0,
                )
            else:
                if infos:
                    params["hostaddr"] = infos[0][4][0]

        return psycopg2.connect(**params)

    engine = create_engine(
        DATABASE_URL,
        creator=_connect,
        pool_pre_ping=True,
        pool_recycle=280,
        pool_use_lifo=True,
        pool_size=10,
        max_overflow=5,
        pool_timeout=10,
    )
else:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()