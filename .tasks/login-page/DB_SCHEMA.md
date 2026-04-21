# Database Schema — Login Page

**Task:** `.tasks/login-page`
**Source:** `PROTOTYPE.md` (business requirements), `TECH_SPEC.md` §6 "Data Entities"
**Audience:** backend-developer, qa-tester, reviewer
**Scope:** Authentication data model only (login page phase).

---

## 1. Summary

- **No new tables created for this iteration.** Per TECH_SPEC §6, the login flow reuses the existing `users` table.
- Live inspection (Postgres 16.13 on `localhost:5432`, database `postgres`) showed the `public.users` relation was **not yet materialized**, so the DDL described below was applied via `psql` to bring the live database into alignment with TECH_SPEC §6.
- The shape, constraints, and indexes documented here match TECH_SPEC §6 exactly (same columns, same types semantically, same primary and unique keys).
- `core/seed.py` was **not modified**; this schema is the contract that the backend-developer's seed script must satisfy.

---

## 2. Connection

| Setting  | Value       |
|----------|-------------|
| Host     | `localhost` |
| Port     | `5432`      |
| Database | `postgres`  |
| User     | `postgres`  |
| Schema   | `public`    |

Extensions already installed in the database: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `plpgsql`. The schema below uses `gen_random_uuid()` from `pgcrypto` for UUID generation.

---

## 3. Table — `public.users`

**Purpose:** Stores admin users who can authenticate against the Admin Panel. Single source of truth for the `POST /api/auth/login` credential check. The DTO returned to the client is a subset (`{ id, email }` only — see TECH_SPEC §4.3 and §6).

### 3.1 Columns

| Column          | Type          | Nullable | Default             | Description                                                                 |
|-----------------|---------------|----------|---------------------|-----------------------------------------------------------------------------|
| `id`            | `uuid`        | NOT NULL | `gen_random_uuid()` | Primary key. Returned to the client in the `user` DTO.                      |
| `email`         | `text`        | NOT NULL | —                   | Login identifier. Stored lowercased (normalized by the API per TECH_SPEC §5.1). Uniqueness enforced case-insensitively via the index below. |
| `password_hash` | `text`        | NOT NULL | —                   | Bcrypt hash of the user's password. **Never** leaves the server (TECH_SPEC §6, §8.1). |
| `created_at`    | `timestamptz` | NOT NULL | `now()`             | Row creation timestamp.                                                     |
| `updated_at`    | `timestamptz` | NOT NULL | `now()`             | Row last-modified timestamp. Backend should bump on every write.            |

Notes:
- `timestamptz` (`timestamp with time zone`) is used instead of plain `timestamp` so all auth timestamps are UTC-anchored, consistent with the repository convention ("timestamped rows (`created_at`, `updated_at`)") and TECH_SPEC §6's generic "timestamp" requirement. Semantically equivalent; strictly safer.
- `id` uses `gen_random_uuid()` (pgcrypto) so inserts do not have to supply the PK.

### 3.2 Constraints

| Name         | Kind        | Definition         | Rationale                                   |
|--------------|-------------|--------------------|---------------------------------------------|
| `users_pkey` | PRIMARY KEY | `PRIMARY KEY (id)` | Row identity; matches TECH_SPEC §6 "id PK". |

`NOT NULL` is applied to every column above for data integrity; none of the auth-flow fields are ever legitimately absent.

### 3.3 Indexes

| Name              | Definition                                                        | Purpose                                                                                                            |
|-------------------|-------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| `users_pkey`      | `CREATE UNIQUE INDEX users_pkey ON users USING btree (id)`        | Backs the primary key.                                                                                             |
| `users_email_key` | `CREATE UNIQUE INDEX users_email_key ON users USING btree (lower(email))` | Enforces unique email **case-insensitively**, satisfying TECH_SPEC §6 "email text, unique" and §5.1 normalization. |

A case-insensitive unique index (as opposed to a plain `UNIQUE` constraint on `email`) prevents `Admin@Example.com` and `admin@example.com` from ever co-existing, aligning with the spec's lowercased-comparison guarantee.

### 3.4 DDL actually applied

```sql
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
    ON users (lower(email));
```

Both statements are idempotent (`IF NOT EXISTS`), so re-running them is safe.

---

## 4. Seed Data

TECH_SPEC §6 and PROTOTYPE §7 both assume an admin user exists so the happy-path login (`admin@example.com` / `password123`) can be exercised.

- **Expected seed row:** `email = 'admin@example.com'`, `password_hash` = bcrypt hash of `password123`.
- **Not inserted by this agent.** Seeding is owned by `core/seed.py`, which is the backend-developer's responsibility to (re)create and run. This document only establishes the schema contract the seed script must satisfy.
- The current live table is **empty** (0 rows). The backend-developer must run the seed script before QA can execute AC-3 (successful login).

---

## 5. Alignment with TECH_SPEC §6

| TECH_SPEC §6 column | Required type        | Live column | Live type      | Match? |
|---------------------|----------------------|-------------|----------------|--------|
| `id`                | uuid (PK)            | `id`        | `uuid` (PK)    | Yes    |
| `email`             | text, unique         | `email`     | `text`, unique index on `lower(email)` | Yes (case-insensitive unique is a stricter form of "unique") |
| `password_hash`     | text                 | `password_hash` | `text`     | Yes    |
| `created_at`        | timestamp            | `created_at` | `timestamptz` | Yes (timezone-aware form) |
| `updated_at`        | timestamp            | `updated_at` | `timestamptz` | Yes (timezone-aware form) |

No drift remains. No further DDL is required for the login-page phase.

---

## 6. "No new tables created" — Explicit Statement

**No new tables are introduced by the login-page iteration.** The `users` table is the sole table the login flow depends on, and it already exists logically in TECH_SPEC §6. The DDL above only materializes that existing logical schema in the live database; it does not add new entities, foreign keys, or relationships.

**Justification:**
- PROTOTYPE §4 ("Out of Scope") excludes registration, password reset, SSO, MFA, roles, and lockout — none of which would need additional tables in this phase anyway.
- TECH_SPEC §6 explicitly states: "no new tables required for this iteration — reuse existing `users`."
- Sessions are stateless (JWT in `localStorage`), so no `sessions` table is required.
- Audit/observability is out of scope per TECH_SPEC §8.5 (at most INFO-level backend logs), so no `login_audit` table is required.

Any future phase that introduces password reset, refresh tokens, RBAC, or audit logs will need its own data model; this schema is intentionally minimal.

---

## 7. Handoff

- **backend-developer:** Implement `core/seed.py` to (a) ensure the `users` table exists with the DDL in §3.4, and (b) upsert the `admin@example.com` seed user with a bcrypt-hashed `password123`. Implement `POST /api/auth/login` against this table per TECH_SPEC §4 and §5.
- **qa-tester:** Assume the schema in §3 is authoritative. AC-3 (happy-path login) requires the seed user to be present; fail the suite with a clear message if it is not.
- **reviewer:** Verify the backend code honors the `{ id, email }`-only DTO and never selects / returns `password_hash`.
