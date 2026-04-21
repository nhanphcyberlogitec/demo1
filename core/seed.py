"""Seed the users table for local development.

Creates the `users` table idempotently (matching DB_SCHEMA.md §3.4) and
upserts the admin seed row used by PROTOTYPE.md / TECH_SPEC.md §6.

Run:
    cd core && source venv/bin/activate && python seed.py
"""

from __future__ import annotations

import bcrypt

from database import get_connection, release_connection

DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
    ON users (lower(email));
"""

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "password123"


def _hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(plaintext.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed() -> None:
    """Ensure schema + seed admin user exist. Safe to run repeatedly."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(DDL)

            cur.execute(
                "SELECT id FROM users WHERE lower(email) = %s",
                (ADMIN_EMAIL,),
            )
            existing = cur.fetchone()

            password_hash = _hash_password(ADMIN_PASSWORD)

            if existing is None:
                cur.execute(
                    "INSERT INTO users (email, password_hash) VALUES (%s, %s)",
                    (ADMIN_EMAIL, password_hash),
                )
                print(f"[seed] inserted admin user: {ADMIN_EMAIL}")
            else:
                cur.execute(
                    "UPDATE users SET password_hash = %s, updated_at = now() "
                    "WHERE lower(email) = %s",
                    (password_hash, ADMIN_EMAIL),
                )
                print(f"[seed] refreshed admin password: {ADMIN_EMAIL}")

        conn.commit()
    finally:
        release_connection(conn)


if __name__ == "__main__":
    seed()
