import psycopg2
from psycopg2 import pool

_connection_pool = None


def _get_pool():
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            host="localhost",
            port=5432,
            database="postgres",
            user="postgres",
            password="mat_khau_moi_cua_ban",
        )
    return _connection_pool


def get_connection():
    return _get_pool().getconn()


def release_connection(conn):
    _get_pool().putconn(conn)
