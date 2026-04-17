# DB_SCHEMA.md — Admin Panel

**Version:** 1.0
**Date:** 2026-04-14
**Author:** Data Modeler Agent
**Sources:** `PROTOTYPE.md` v1.0, `TECH_SPEC.md` v1.0 (both approved 2026-04-14)
**Status:** Draft — pending user review

---

## 1. Purpose

This document defines the PostgreSQL schema required by the approved
`PROTOTYPE.md` and `TECH_SPEC.md` for the **Simple Login Page**. Only the
entities required by the current scope are modelled; out-of-scope features
(password reset, MFA, sessions, audit log, etc.) are deliberately omitted.

## 2. Conventions

- Engine: **PostgreSQL** (local dev: `localhost:5432`, database `postgres`).
- Naming: `snake_case` for tables and columns.
- Primary keys: `uuid`, server-generated via `gen_random_uuid()` (requires the
  `pgcrypto` extension).
- Timestamps: every row carries `created_at` and `updated_at`
  (`timestamptz`, default `NOW()`); `updated_at` is maintained by a
  `BEFORE UPDATE` trigger.
- Text-based identifiers (e.g. email) are stored lowercased and
  `UNIQUE`-indexed.

## 3. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Used by `gen_random_uuid()` for primary-key defaults.

## 4. Entities

### 4.1 `users`

Backs `POST /api/auth/login` (TECH_SPEC §5.2). Each row represents one
administrator account.

| Column          | Type           | Constraints                          | Notes                                            |
|-----------------|----------------|--------------------------------------|--------------------------------------------------|
| `id`            | `uuid`         | `PK`, default `gen_random_uuid()`    | Stable identifier; used as JWT `sub`.            |
| `email`         | `varchar(255)` | `NOT NULL`, `UNIQUE`                 | Login identifier; stored lowercased.             |
| `password_hash` | `varchar(255)` | `NOT NULL`                           | bcrypt hash; plaintext is never stored.          |
| `is_active`     | `boolean`      | `NOT NULL`, default `TRUE`           | Inactive users are rejected with generic `401`.  |
| `created_at`    | `timestamptz`  | `NOT NULL`, default `NOW()`          | Row creation timestamp.                          |
| `updated_at`    | `timestamptz`  | `NOT NULL`, default `NOW()`          | Auto-updated on every row change (trigger).      |

**Indexes**

- `users_pkey` — `PRIMARY KEY (id)`
- `users_email_key` — `UNIQUE (email)`

`UNIQUE (email)` doubles as the lookup index for login
(`SELECT … WHERE LOWER(email) = LOWER($1)`).

### 4.2 Out-of-scope (explicitly deferred)

No additional tables are created in this iteration. The following are
acknowledged as likely future entities but are **not** modelled now:

- `sessions` / `refresh_tokens` — login currently uses a short-lived JWT only.
- `password_reset_tokens` — reset flow is out of scope.
- `login_attempts` / `audit_log` — rate limiting and auditing are out of scope.
- `roles` / `permissions` — single-role (administrator) model is sufficient.

## 5. DDL

Idempotent DDL applied to the local database. Safe to re-run.

```sql
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
```

## 6. Seed Data

The seed script (`core/seed.py`) inserts one administrator account used by
the acceptance tests (TECH_SPEC §10.1 AC-6):

- **email:** `admin@example.com`
- **password:** `password123` (stored as a bcrypt hash in `password_hash`)
- **is_active:** `TRUE`

Seeding is idempotent: existing `admin@example.com` is upserted, not
duplicated.

## 7. Access & Operations

- **Connection** (local dev): host `localhost`, port `5432`, database
  `postgres`, user `postgres`. Password is configured via the `DB_PASSWORD`
  environment variable (default `postgres` per `core/database.py`).
- **Migrations:** this project does not yet use a migration tool. The DDL in
  §5 is the source of truth; apply it manually or via `core/seed.py`.
- **Backups / retention:** out of scope for local development.

## 8. Security Notes

- `password_hash` stores only bcrypt hashes; plaintext passwords MUST NEVER
  be written to this column, logs, or error messages (TECH_SPEC §7).
- Queries on `email` MUST use `LOWER(email) = LOWER($1)` to match the
  lowercased-storage rule (TECH_SPEC §5.2 behavior).
- Failed logins (unknown email, wrong password, `is_active = FALSE`) MUST
  return the identical generic `401`; the database layer does not need to
  distinguish these cases, but callers must.

## 9. Verification

After applying §5, the following should hold in the `postgres` database:

```
\d users
```

Expected:

- Columns `id`, `email`, `password_hash`, `is_active`, `created_at`,
  `updated_at` with the types/constraints above.
- Indexes: `users_pkey` and `users_email_key`.
- Trigger: `trg_users_set_updated_at` on `BEFORE UPDATE`.

Applied and verified on 2026-04-14 against `localhost:5432/postgres`.
