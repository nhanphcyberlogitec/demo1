# Account Page — Database Schema

**Document type:** Database Schema / Migration Spec
**Status:** Draft — pending user review (blocking gate before backend work)
**Author:** Data Modeler Agent
**Date:** 2026-04-14
**Source:** `PROTOTYPE.md`, `TECH_SPEC.md` (approved 2026-04-14)

---

## 1. Goals

Support the Account Page features in TECH_SPEC §5 with these properties:

- Case-insensitive email uniqueness (BR-4, BR-6, TECH_SPEC §6.2).
- Fast status filtering (`is_active`) (BR-2, TECH_SPEC §5.1).
- Fast partial-match search across `name` and `email` (BR-2, TECH_SPEC §5.1 `q` query param).
- Inactive-login gating unchanged at the data layer — enforced in the login route using `is_active`.

## 2. Current vs. target state

### 2.1 Observed current state (verified via psql against `localhost:5432/postgres`)

```
Table "public.users"
    Column     |           Type           | Nullable |      Default
---------------+--------------------------+----------+-------------------
 id            | uuid                     | not null | gen_random_uuid()
 email         | varchar(255)             | not null |
 password_hash | varchar(255)             | not null |
 is_active     | boolean                  | not null | true
 created_at    | timestamptz              | not null | now()
 updated_at    | timestamptz              | not null | now()
 display_name  | varchar(60)              | null     |
Indexes:
    "users_pkey" PRIMARY KEY, btree (id)
    "users_email_key" UNIQUE CONSTRAINT, btree (email)
Trigger:
    trg_users_set_updated_at BEFORE UPDATE ON users
Extensions installed: plpgsql, uuid-ossp, pgcrypto  (pg_trgm not yet installed)
Rows: 2 (admin@example.com, tester@example.com — both display_name IS NULL)
```

Divergence from TECH_SPEC §4.1:
- TECH_SPEC calls the profile-name column `name varchar(100) NOT NULL`. The real table uses `display_name varchar(60)` nullable. We align the DB with the spec by **renaming/widening/backfilling**.
- TECH_SPEC calls for a **`lower(email)` unique index**. The real table enforces a plain `UNIQUE (email)` which is case-sensitive. We replace it.
- `is_active` is already in place — no add needed.

### 2.2 Target schema

| Column          | Type              | Constraints                             | Notes                                                   |
|-----------------|-------------------|-----------------------------------------|---------------------------------------------------------|
| `id`            | `uuid`            | PK, default `gen_random_uuid()`         | Unchanged.                                              |
| `email`         | `varchar(255)`    | NOT NULL; unique on `lower(email)`      | Unique constraint replaced with expression index.       |
| `password_hash` | `varchar(255)`    | NOT NULL                                | Unchanged. Never returned by the API.                   |
| `name`          | `varchar(100)`    | NOT NULL                                | Renamed from `display_name`, widened 60→100, backfilled.|
| `is_active`     | `boolean`         | NOT NULL, default `true`                | Unchanged.                                              |
| `created_at`    | `timestamptz`     | NOT NULL, default `now()`               | Unchanged.                                              |
| `updated_at`    | `timestamptz`     | NOT NULL, default `now()`               | Unchanged, trigger maintains it.                        |

## 3. Indexes

| Index                       | Definition                                                            | Purpose                                                  |
|-----------------------------|-----------------------------------------------------------------------|----------------------------------------------------------|
| `users_pkey`                | PRIMARY KEY btree (`id`)                                              | Existing.                                                |
| `users_email_lower_key`     | `CREATE UNIQUE INDEX ON users (lower(email))`                         | Replaces `users_email_key`; case-insensitive uniqueness. |
| `idx_users_is_active`       | `CREATE INDEX ON users (is_active)`                                   | TECH_SPEC §5.1 `status` filter.                          |
| `idx_users_email_trgm`      | `CREATE INDEX ON users USING gin (lower(email) gin_trgm_ops)`         | TECH_SPEC §5.1 `q` param — ILIKE / substring search.     |
| `idx_users_name_trgm`       | `CREATE INDEX ON users USING gin (lower(name) gin_trgm_ops)`          | Same — search by name substring.                         |

**Why pg_trgm over a plain `lower(name)` btree:** the list page uses `%term%` substring matching (BR-2 "search by name or email"). Plain btree on `lower(col)` only accelerates prefix queries. Trigram GIN indexes cover both prefix and infix — the cost (slightly larger index, slower writes) is acceptable for a low-churn `users` table.

## 4. Extensions

- `pgcrypto` — already installed (used for `gen_random_uuid()`).
- `pg_trgm` — **new**, required for the GIN trigram indexes above.

## 5. Migration SQL

Applied idempotently via the Postgres MCP / psql session. Safe to re-run.

```sql
BEGIN;

-- 1. pg_trgm for substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Rename display_name → name (no-op if already renamed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'display_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'name'
    ) THEN
        ALTER TABLE users RENAME COLUMN display_name TO name;
    END IF;
END$$;

-- 3. Widen to varchar(100)
ALTER TABLE users ALTER COLUMN name TYPE varchar(100);

-- 4. Backfill NULLs using email local-part as a safe placeholder, then lock NOT NULL
UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL OR btrim(name) = '';
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- 5. Case-insensitive unique email
DROP INDEX IF EXISTS users_email_key;              -- old constraint index
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- 6. Supporting indexes
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (lower(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm  ON users USING gin (lower(name)  gin_trgm_ops);

COMMIT;
```

## 6. Backend code impact — handoff to backend-developer

### 6.1 Decision: rename `display_name` → `name` (not keep `display_name`)

TECH_SPEC §4 explicitly names the column `name` and the API DTO field `name`. Two options were considered:

| Option | Pros | Cons |
|--------|------|------|
| **Rename `display_name` → `name`** (chosen) | DB matches TECH_SPEC verbatim; new `/api/accounts*` routes stay clean; API field name is stable going forward. | Existing `core/main.py` profile code must be updated (one file, ~15 refs). |
| Keep `display_name`; map to `name` in API layer only | No change to existing profile route. | Permanent naming drift between DB and API; every new query has to remember the alias; diverges from TECH_SPEC and confuses reviewers. |

The rename is one-file, low-risk, and leaves the codebase coherent — it's the least disruptive option **once the downstream churn is counted**. Migration is already applied.

### 6.2 Required code updates (backend-developer, phase 3 task #4)

**`core/main.py`** — replace every `display_name` with `name`:
- `UserInDB.display_name` field (line ~101) → `name`
- SELECT list in login query (line ~127) and its unpacking (line ~138, ~147)
- Profile response JSON (line ~233) — key `"display_name"` → `"name"`
- `ProfileUpdate.display_name` Pydantic field (line ~249) → `name`
- `display_name_touched`, `new_display_name`, `errors["display_name"]`, `updates["display_name"]` block (lines ~276–325) — rename variables and error keys to `name` / `errors["name"]` / `updates["name"]`
- Length validation `Must be 1–60 characters` → **`Must be 1–100 characters`** (TECH_SPEC §6.1: trimmed length 1–100)
- Profile GET SELECT + unpack (line ~353, ~369, ~375)

**`core/seed.py`**:
1. Add `name varchar(100) NOT NULL` to the `CREATE TABLE` block (after `password_hash`).
2. Include `name = 'Administrator'` in the admin upsert; extend `ON CONFLICT DO UPDATE` to also set `name`.

**API compatibility note:** the existing profile endpoint's response key `display_name` is changing to `name`. The frontend only has the login page + dashboard shipped today (neither reads `display_name`), so there is no deployed client to break — it's safe to rename outright rather than dual-publish.

### 6.3 Post-update verification

After backend-developer rewires the code, re-run `python core/seed.py` to upsert `name = 'Administrator'` over the placeholder value the migration backfilled.

Proposed admin row after seed re-run:
- email `admin@example.com`, name `Administrator`, is_active `true`.

## 7. Backfill outcome (verification queries)

```sql
-- expect no nulls, no empties
SELECT count(*) FROM users WHERE name IS NULL OR btrim(name) = '';

-- expect the two existing rows with names derived from email local-part
SELECT email, name, is_active FROM users ORDER BY email;

-- expect the four new indexes to exist
SELECT indexname FROM pg_indexes WHERE tablename = 'users' ORDER BY indexname;
```

Post-migration, the seeded admin retains `is_active = true` and receives `name = 'admin'` from the backfill; the backend-developer should re-run `python seed.py` after updating it to overwrite with `Administrator`.

## 8. Operational notes

- **Write amplification:** three GIN indexes on a low-write table is fine. If `users` ever becomes write-heavy, re-evaluate dropping `idx_users_email_trgm` (email is typically searched by prefix and already has a case-insensitive unique index).
- **Vacuum:** no special tuning needed at current volume (~2 rows).
- **Rollback:** each step has a safe inverse (`ALTER TABLE users RENAME COLUMN name TO display_name`, `DROP INDEX …`, `DROP EXTENSION pg_trgm`). Combined rollback not scripted — size of the data is trivial.

## 9. Out of scope

- New tables for RBAC, audit log, or password-reset tokens — deferred per TECH_SPEC §9.
- Partitioning, sharding, replication topology — not needed at this scale.

---

**Review requested.** Please confirm the schema before backend-developer begins on `BACKEND_API.md` + route implementation.
