"""PostgreSQL connection pool for the core API.

Uses psycopg2's `ThreadedConnectionPool` so the FastAPI workers can check out
connections without blocking one another. Connection parameters come from
environment variables so the same code works for local dev, tests, and CI.
"""

from __future__ import annotations

import os
from typing import Optional

from psycopg2.pool import ThreadedConnectionPool

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

_pool: Optional[ThreadedConnectionPool] = None


def _get_pool() -> ThreadedConnectionPool:
    """Lazily create the shared connection pool on first use."""
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
    return _pool


def get_connection():
    """Check out a connection from the pool. Pair every call with release_connection()."""
    return _get_pool().getconn()


def release_connection(conn) -> None:
    """Return a connection to the pool."""
    _get_pool().putconn(conn)


def close_pool() -> None:
    """Close every connection; mostly useful for tests and shutdown hooks."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
