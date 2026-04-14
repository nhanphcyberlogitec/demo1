"""Seed the database with schema and the default admin user.

Run:
    python seed.py
"""

import bcrypt

from database import get_connection, release_connection

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
    id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(255)   NOT NULL,
    password_hash varchar(255)   NOT NULL,
    name          varchar(100)   NOT NULL,
    is_active     boolean        NOT NULL DEFAULT TRUE,
    created_at    timestamptz    NOT NULL DEFAULT NOW(),
    updated_at    timestamptz    NOT NULL DEFAULT NOW()
);

-- Align with .tasks/account-page/DB_SCHEMA.md: case-insensitive unique email
DROP INDEX IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (lower(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm  ON users USING gin (lower(name)  gin_trgm_ops);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
"""

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "password123"
ADMIN_NAME = "Administrator"


def main() -> None:
    password_hash = bcrypt.hashpw(
        ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            cur.execute(
                """
                INSERT INTO users (email, password_hash, name, is_active)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (lower(email)) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        name          = EXCLUDED.name,
                        is_active     = TRUE
                """,
                (ADMIN_EMAIL, password_hash, ADMIN_NAME),
            )
        conn.commit()
    finally:
        release_connection(conn)

    print(f"Seeded admin user: {ADMIN_EMAIL}")


if __name__ == "__main__":
    main()
