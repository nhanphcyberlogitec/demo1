"""Seed the database with schema and the default admin user.

Run:
    python seed.py
"""

import bcrypt

from database import get_connection, release_connection

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(255)   NOT NULL UNIQUE,
    password_hash varchar(255)   NOT NULL,
    is_active     boolean        NOT NULL DEFAULT TRUE,
    created_at    timestamptz    NOT NULL DEFAULT NOW(),
    updated_at    timestamptz    NOT NULL DEFAULT NOW()
);

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
                INSERT INTO users (email, password_hash, is_active)
                VALUES (%s, %s, TRUE)
                ON CONFLICT (email) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        is_active     = TRUE
                """,
                (ADMIN_EMAIL, password_hash),
            )
        conn.commit()
    finally:
        release_connection(conn)

    print(f"Seeded admin user: {ADMIN_EMAIL}")


if __name__ == "__main__":
    main()
