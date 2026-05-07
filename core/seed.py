"""Seed the users table for local development.

Brings any database state to the live shape documented in
`.tasks/dashboard-user-crud/DB_SCHEMA.md` §3.4 and upserts the seeded admin
row so `POST /api/auth/login` and `GET /api/users` work out of the box.

The script is idempotent: re-running it touches zero rows on a database that
is already in the target shape with the seeded admin present.

Run:
    cd core && source venv/bin/activate && python seed.py
"""

from __future__ import annotations

import bcrypt

from database import get_connection, release_connection

# DDL — covers both fresh installs (CREATE TABLE) and live drift (ALTER + CHECK).
# Mirrors the canonical migration block in `.tasks/dashboard-user-crud/DB_SCHEMA.md`
# §3.4 so a fresh database lands on the same shape as the live DB.
DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
    ON users (lower(email));

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Defensive backfill for rows missing a name (touches 0 rows on a fresh install
-- where there are no users yet, and 0 rows on the live DB where every row
-- already has a name).
UPDATE users
   SET name = split_part(email, '@', 1),
       updated_at = now()
 WHERE name IS NULL OR name = '';

ALTER TABLE users
    ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'users_role_check'
           AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user'));
    END IF;
END$$;
"""

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "password123"
ADMIN_NAME = "Admin"
ADMIN_ROLE = "admin"


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
                    "INSERT INTO users (email, password_hash, name, role) "
                    "VALUES (%s, %s, %s, %s)",
                    (ADMIN_EMAIL, password_hash, ADMIN_NAME, ADMIN_ROLE),
                )
                print(f"[seed] inserted admin user: {ADMIN_EMAIL}")
            else:
                # Refresh password and re-assert role='admin'. Preserve any
                # hand-edited name (only fall back to 'Admin' if name is
                # missing/empty) so a developer renaming the seed admin
                # locally doesn't get clobbered every time seed.py runs.
                cur.execute(
                    "UPDATE users SET password_hash = %s, "
                    "name = COALESCE(NULLIF(name, ''), %s), "
                    "role = %s, updated_at = now() "
                    "WHERE lower(email) = %s",
                    (password_hash, ADMIN_NAME, ADMIN_ROLE, ADMIN_EMAIL),
                )
                print(f"[seed] refreshed admin credentials: {ADMIN_EMAIL}")

        conn.commit()
    finally:
        release_connection(conn)


if __name__ == "__main__":
    seed()
