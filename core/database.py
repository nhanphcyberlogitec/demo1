"""PostgreSQL connection-pool helper.

A single module-level :class:`ThreadedConnectionPool` is shared by every
request handler.  Use :func:`get_connection` to borrow a connection and
:func:`release_connection` to return it (always release in a ``finally`` block,
even on error, or the pool will leak).
"""

from __future__ import annotations

import os
from typing import Optional

import psycopg2
from psycopg2 import pool as pg_pool


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "1234"),
}

_MIN_CONN = int(os.getenv("DB_POOL_MIN", "2"))
_MAX_CONN = int(os.getenv("DB_POOL_MAX", "10"))

_pool: Optional[pg_pool.ThreadedConnectionPool] = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    """Lazily create the pool on first access (so importing the module never
    fails when Postgres isn't reachable, e.g. during static analysis)."""
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(_MIN_CONN, _MAX_CONN, **DB_CONFIG)
    return _pool


def get_connection():
    """Borrow a connection from the pool. Caller must call
    :func:`release_connection` when done."""
    return _get_pool().getconn()


def release_connection(conn) -> None:
    """Return a connection to the pool. Safe to call with ``None``."""
    if conn is None:
        return
    _get_pool().putconn(conn)


__all__ = ["get_connection", "release_connection", "DB_CONFIG"]
