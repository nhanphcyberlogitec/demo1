"""Seed an admin user for local development.

The `users` table and its schema are created and maintained by the data-modeler
(see `.tasks/login-page/DB_SCHEMA.md`). This script only ensures the default
admin row exists so the login flow can be demoed end-to-end.

Usage:
    source venv/bin/activate
    python seed.py
"""

import sys

import bcrypt

from database import close_pool, get_connection, release_connection

DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASSWORD = "password123"
DEFAULT_NAME = "Admin User"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_admin_user(email: str = DEFAULT_EMAIL, password: str = DEFAULT_PASSWORD, name: str = DEFAULT_NAME) -> str:
    password_hash = _hash_password(password)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.users (email, password_hash, name, full_name, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (lower(email))
                DO UPDATE SET password_hash = EXCLUDED.password_hash,
                              full_name     = EXCLUDED.full_name,
                              is_active     = TRUE
                RETURNING id
                """,
                (email, password_hash, name, name),
            )
            user_id = cur.fetchone()[0]
        conn.commit()
        return str(user_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def main() -> int:
    try:
        user_id = seed_admin_user()
        print(f"Seeded admin user: email={DEFAULT_EMAIL} id={user_id}")
        return 0
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    finally:
        close_pool()


if __name__ == "__main__":
    sys.exit(main())
