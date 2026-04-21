"""Seed the database with schema + the default admin user.

Run:
    python seed.py

Schema per `.tasks/login-page/TECH_SPEC.md` §4.1.
Default admin: admin@example.com / password123 (per PROTOTYPE §7 and
the convention referenced in TECH_SPEC §4.1).
"""

import bcrypt

from database import get_connection, release_connection

# Mirrors DB_SCHEMA.md §6 (the canonical migration). Idempotent.
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           varchar(255) NOT NULL UNIQUE,
    password_hash   varchar(255) NOT NULL,
    name            varchar(255) NULL,
    is_active       boolean      NOT NULL DEFAULT true,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
    ON users (lower(email));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
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
            # Upsert against the functional unique index on lower(email).
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
