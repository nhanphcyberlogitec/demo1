"""PostgreSQL connection pool for the admin panel backend.

Uses a module-level ThreadedConnectionPool (min=2, max=10).
Call get_connection() to obtain a connection and release_connection()
to return it to the pool when done.
"""

import os
from typing import Optional

from psycopg2 import pool as pg_pool

_DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

_connection_pool: Optional[pg_pool.ThreadedConnectionPool] = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pg_pool.ThreadedConnectionPool(
            minconn=2, maxconn=10, **_DB_CONFIG
        )
    return _connection_pool


def get_connection():
    """Borrow a connection from the pool."""
    return _get_pool().getconn()


def release_connection(conn) -> None:
    """Return a connection to the pool."""
    _get_pool().putconn(conn)
