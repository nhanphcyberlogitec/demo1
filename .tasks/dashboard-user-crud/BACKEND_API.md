# Backend API — Dashboard + User CRUD

**Task:** `.tasks/dashboard-user-crud`
**Source of truth:** `core/main.py` (this document mirrors what the code actually does, not what the spec said in theory)
**Audience:** frontend-developer, qa-tester, reviewer
**Spec references:** `.tasks/dashboard-user-crud/TECH_SPEC.md` §5 (API surface), §6 (validation), §7 (auth & access control); `.tasks/dashboard-user-crud/DB_SCHEMA.md` (storage shape).

---

## 1. Conventions

### 1.1 Envelope

Every response from `core/main.py` (success or error, every status) has the shape:

```json
{ "success": true | false, "data": <object> | null, "message": "<string>" }
```

`success` is always the boolean inverse of "is this an error". `message` is a short user-facing string (or `""` for plain successes that have nothing to say). `data` is the payload on success and either `null` or a `{ "errors": {...} }` field-error map on validation failures.

### 1.2 Auth header

All `/api/users/...` endpoints require:

```
Authorization: Bearer <jwt>
```

`<jwt>` is the same HS256 token issued by `POST /api/auth/login` (60-min expiry, payload `{sub, email, exp}`). Failures of any kind — header missing, malformed, scheme not `Bearer`, empty token, signature/expiry/decode failure, or `sub` resolves to no row — return:

```http
HTTP/1.1 401 Unauthorized
{ "success": false, "data": null, "message": "Not authenticated" }
```

The dependency lives in `core/main.py::current_user` and runs before the handler body.

### 1.3 Error model summary

| HTTP | When | `message` examples |
|---|---|---|
| 200 | Success | `"Login successful"`, `"User updated"`, `"User deleted"`, `""` |
| 201 | Created | `"User created"` |
| 400 | Business rule that isn't field-shaped | `"You cannot delete your own account"`, `"Cannot remove the last administrator"` |
| 401 | Auth failure | `"Not authenticated"` (protected endpoints); `"Invalid email or password"` (login) |
| 404 | Resource missing | `"User not found"` |
| 422 | Field validation failure | `"Validation failed"` or `"Email already in use"` or `"Cannot remove the last administrator"`; `data.errors` keyed by field |
| 500 | Unexpected error | `"Internal server error"` |

### 1.4 Field-level validation messages (verbatim from validators)

| Field | Trigger | Message |
|---|---|---|
| email | empty / whitespace | `"Email is required"` |
| email | non-string / wrong type | `"Email is required"` |
| email | over 254 chars | `"Email is too long"` |
| email | does not match RFC-lite regex | `"Enter a valid email address"` |
| email | already exists in `users` (excluding self on PATCH) | `"Email already in use"` |
| name | empty / whitespace | `"Name is required"` |
| name | over 100 chars (after trim) | `"Name is too long"` |
| role | empty | `"Role is required"` |
| role | not in `{"admin","user"}` | `"Invalid role"` |
| role | demoting last admin | `"Cannot remove the last administrator"` |
| password | empty | `"Password is required"` |
| password | < 8 chars | `"Password must be at least 8 characters"` |
| password | > 128 chars | `"Password is too long"` |
| page | not a positive int | `"Page must be a positive integer"` |
| limit | not 1..100 | `"Limit must be between 1 and 100"` |

`data.errors` keys match the body field names: `email`, `name`, `role`, `password`, `page`, `limit`. PATCH with empty body returns `data.errors._ = "No changes provided"`.

### 1.5 Normalization

The validators run before the handler:

- **email** is `.strip().lower()` before storage and comparison.
- **name** is `.strip()` before storage. No case folding.
- **role** is `.strip()` before storage.
- **password** is left as-is on the wire, then bcrypt-hashed on insert/update. Plaintext is never logged or persisted; bcrypt hash is never returned.

### 1.6 What the API never returns

`password` and `password_hash` do not appear in any response payload at any depth — neither on success nor on error. Verified by grep + smoke test (no `$2b$` substring in any body).

---

## 2. `POST /api/auth/login` — Authenticate (existing — unchanged)

| | |
|---|---|
| Method | `POST` |
| Path | `/api/auth/login` |
| Auth | none |
| Source | `core/main.py::login` |

### 2.1 Request

```json
{ "email": "admin@example.com", "password": "password123" }
```

### 2.2 Responses

**200 OK**

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": "968d63a1-…", "email": "admin@example.com" }
  },
  "message": "Login successful"
}
```

**401 Unauthorized** (unknown email or wrong password — indistinguishable on purpose)

```json
{ "success": false, "data": null, "message": "Invalid email or password" }
```

**422 Unprocessable Entity** — field validation (see §1.4)

```json
{
  "success": false,
  "data": { "errors": { "email": "Enter a valid email address" } },
  "message": "Validation failed"
}
```

### 2.3 Curl

```bash
curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'
```

---

## 3. `GET /api/users` — List users (paginated, searchable)

| | |
|---|---|
| Method | `GET` |
| Path | `/api/users` |
| Auth | required (Bearer JWT) |
| Source | `core/main.py::list_users` |

### 3.1 Query parameters

| Name | Type | Default | Bounds | Notes |
|---|---|---|---|---|
| `q` | string | `""` | trimmed; empty = no filter | Case-insensitive `LIKE %q%` against `lower(email)` and `lower(name)`. `%`, `_`, and `\` are escaped before pattern construction so user input cannot inject wildcards. |
| `page` | int | `1` | ≥ 1 | 1-based. Out-of-range or non-integer → 422 `data.errors.page`. |
| `limit` | int | `10` | 1–100 | Page size. Out-of-range or non-integer → 422 `data.errors.limit`. |

Ordering is fixed: `created_at DESC, id ASC` (newest first; stable tiebreak on id).

### 3.2 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "968d63a1-51a0-4b8b-9517-5bd4cf7e2ebf",
        "email": "admin@example.com",
        "name": "Admin",
        "role": "admin",
        "created_at": "2026-04-17T15:46:37.792904+07:00",
        "updated_at": "2026-05-07T11:02:56.970138+07:00"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "total_pages": 1 }
  },
  "message": ""
}
```

`total_pages` is `0` when `total == 0` (no users match), otherwise `ceil(total / limit)`. Each item is the canonical `UserDTO`: `id, email, name, role, created_at, updated_at`. Timestamps are ISO 8601 with offset (Python `datetime.isoformat()` — uses `+HH:MM`, not the `Z` suffix; both forms are valid ISO 8601).

### 3.3 422 Unprocessable Entity (bad query params)

```json
{
  "success": false,
  "data": { "errors": { "page": "Page must be a positive integer" } },
  "message": "Validation failed"
}
```

(Multiple errors are collected; e.g. `page` and `limit` can both be reported in one response.)

### 3.4 401 Unauthorized — see §1.2.

### 3.5 Curl

```bash
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .data.token)

# default page
curl -sS http://localhost:8000/api/users -H "Authorization: Bearer $TOKEN"

# search + paginate
curl -sS 'http://localhost:8000/api/users?q=admin&page=1&limit=5' \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. `POST /api/users` — Create user

| | |
|---|---|
| Method | `POST` |
| Path | `/api/users` |
| Auth | required (Bearer JWT) |
| Source | `core/main.py::create_user` |

### 4.1 Request body

```json
{
  "email": "new.user@example.com",
  "name": "New User",
  "role": "user",
  "password": "correct horse battery staple"
}
```

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Trim + lowercase before storage. ≤ 254 chars. RFC-lite regex (§1.4). |
| `name` | yes | Trim. 1–100 chars after trim. |
| `role` | yes (server defaults to `"user"` if **omitted**; explicit empty string is rejected) | One of `"admin"`, `"user"`. |
| `password` | yes | 8–128 chars. Bcrypt-hashed; never echoed back. |

### 4.2 201 Created

```json
{
  "success": true,
  "data": {
    "id": "f5…",
    "email": "new.user@example.com",
    "name": "New User",
    "role": "user",
    "created_at": "2026-05-07T03:50:00+00:00",
    "updated_at": "2026-05-07T03:50:00+00:00"
  },
  "message": "User created"
}
```

### 4.3 422 — field validation

Examples:

```json
{
  "success": false,
  "data": { "errors": {
    "email": "Email is required",
    "name": "Name is required",
    "password": "Password is required"
  }},
  "message": "Validation failed"
}
```

```json
{
  "success": false,
  "data": { "errors": {
    "email": "Enter a valid email address",
    "role": "Invalid role",
    "password": "Password must be at least 8 characters"
  }},
  "message": "Validation failed"
}
```

### 4.4 422 — duplicate email

```json
{
  "success": false,
  "data": { "errors": { "email": "Email already in use" } },
  "message": "Email already in use"
}
```

A pre-check (`SELECT 1 FROM users WHERE lower(email) = $1`) catches the common case; a `psycopg2.errors.UniqueViolation` from the `users_email_lower_key` index covers the race window between pre-check and insert. Both produce the body above.

> **Status-code choice:** TECH_SPEC §5.3 allowed either 409 or 422 here. The implementation returns **422** so the front-end's "field error" code path always matches a single status. Front-end code that already handles 409 will still see a `data.errors.email` body and degrade fine, but should not need to.

### 4.5 401 — see §1.2.

### 4.6 Curl

```bash
TOKEN=...   # as in §3.5

curl -sS -X POST http://localhost:8000/api/users \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"new.user@example.com","name":"New User","role":"user","password":"correct horse battery staple"}'
```

---

## 5. `PATCH /api/users/{id}` — Partial update

| | |
|---|---|
| Method | `PATCH` |
| Path | `/api/users/{id}` |
| Auth | required (Bearer JWT) |
| Source | `core/main.py::update_user` |

`{id}` is a UUID. Malformed UUIDs are treated as "not found" (404); FastAPI's path layer does not auto-validate the UUID — the handler does, so the response is still envelope-shaped.

### 5.1 Request body

Every field is optional. Fields that are absent (or explicitly `null`) are not changed. Sending an explicit empty value triggers field validation (e.g. `"email": ""` → 422 "Email is required"). The body must contain at least one field that resolves to a non-null change; otherwise 422 `data.errors._ = "No changes provided"`.

```json
{
  "email": "updated@example.com",
  "name": "Updated Name",
  "role": "admin",
  "password": "new strong password"
}
```

### 5.2 200 OK

Returns the updated user DTO (no `password`/`password_hash`):

```json
{
  "success": true,
  "data": {
    "id": "f5…",
    "email": "updated@example.com",
    "name": "Updated Name",
    "role": "admin",
    "created_at": "2026-05-07T03:50:00+00:00",
    "updated_at": "2026-05-07T03:55:00+00:00"
  },
  "message": "User updated"
}
```

`updated_at` is set to `now()` whenever the row is rewritten. If `password` is in the body, the bcrypt hash is replaced and the old password stops working immediately on the next `POST /api/auth/login`.

### 5.3 404 — id is malformed or no row exists

```json
{ "success": false, "data": null, "message": "User not found" }
```

### 5.4 422 — field validation

Same shape as POST (§4.3). Includes:

- Empty / malformed values per §1.4.
- Duplicate email (excluding self): `data.errors.email = "Email already in use"`, `message = "Email already in use"`.
- Last-admin demotion: `data.errors.role = "Cannot remove the last administrator"`, `message = "Cannot remove the last administrator"`. The check runs in the same transaction as the write:

  ```sql
  SELECT id, email, name, role FROM users WHERE id = $1 FOR UPDATE;
  -- if 'role' in changes and current_role='admin' and new_role!='admin':
  SELECT count(*) FROM users WHERE role = 'admin' AND id <> $1;
  -- → 0 ⇒ reject with 422
  ```

- Empty body (`{}` after dropping `null`s): `data.errors._ = "No changes provided"`.

### 5.5 401 — see §1.2.

### 5.6 Curls

```bash
TOKEN=...
USER_ID=...

# rename only
curl -sS -X PATCH "http://localhost:8000/api/users/$USER_ID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Renamed"}'

# reset password only
curl -sS -X PATCH "http://localhost:8000/api/users/$USER_ID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"password":"new strong password"}'

# combined
curl -sS -X PATCH "http://localhost:8000/api/users/$USER_ID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"updated@example.com","role":"admin","password":"new strong password"}'
```

---

## 6. `DELETE /api/users/{id}` — Hard delete

| | |
|---|---|
| Method | `DELETE` |
| Path | `/api/users/{id}` |
| Auth | required (Bearer JWT) |
| Source | `core/main.py::delete_user` |

### 6.1 200 OK

```json
{ "success": true, "data": null, "message": "User deleted" }
```

After this, the deleted user can no longer log in (the row is physically gone).

### 6.2 400 — self-delete blocked

When `{id}` equals the JWT's `sub`:

```json
{ "success": false, "data": null, "message": "You cannot delete your own account" }
```

### 6.3 400 — last-admin blocked

When the target row's `role = 'admin'` and there are no other admins (checked inside the same txn as the DELETE):

```json
{ "success": false, "data": null, "message": "Cannot remove the last administrator" }
```

### 6.4 404 — id is malformed or no row exists

```json
{ "success": false, "data": null, "message": "User not found" }
```

### 6.5 401 — see §1.2.

### 6.6 Order of checks

1. JWT validated by the `current_user` dependency (else 401).
2. `{id}` parsed as UUID — if not, 404.
3. `{id} == current_user.id` → 400 self-delete.
4. `SELECT id, role FROM users WHERE id = $1 FOR UPDATE` — if no row, 404.
5. If target is `admin`: count other admins; if 0, 400 last-admin.
6. `DELETE FROM users WHERE id = $1`; commit.

### 6.7 Curl

```bash
TOKEN=...
USER_ID=...

curl -sS -X DELETE "http://localhost:8000/api/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. Internal Notes

### 7.1 SQL queries actually executed

| Operation | Query (parameterized) |
|---|---|
| Login | `SELECT id, email, password_hash FROM users WHERE lower(email) = %s` |
| JWT resolve `sub` | `SELECT id, email, role FROM users WHERE id = %s` |
| List — count | `SELECT count(*) FROM users [WHERE lower(email) LIKE %s OR lower(name) LIKE %s]` |
| List — page | `SELECT id, email, name, role, created_at, updated_at FROM users [WHERE …] ORDER BY created_at DESC, id ASC LIMIT %s OFFSET %s` |
| Create — uniqueness pre-check | `SELECT 1 FROM users WHERE lower(email) = %s` |
| Create — insert | `INSERT INTO users (email, password_hash, name, role) VALUES (%s, %s, %s, %s) RETURNING id, email, name, role, created_at, updated_at` |
| Update — load + lock | `SELECT id, email, name, role FROM users WHERE id = %s FOR UPDATE` |
| Update — uniqueness check | `SELECT 1 FROM users WHERE lower(email) = %s AND id <> %s` |
| Update — last-admin check | `SELECT count(*) FROM users WHERE role = 'admin' AND id <> %s` |
| Update — write | `UPDATE users SET <fields>, updated_at = now() WHERE id = %s RETURNING id, email, name, role, created_at, updated_at` |
| Delete — load + lock | `SELECT id, role FROM users WHERE id = %s FOR UPDATE` |
| Delete — last-admin check | `SELECT count(*) FROM users WHERE role = 'admin' AND id <> %s` |
| Delete — write | `DELETE FROM users WHERE id = %s` |

`password_hash` is **never** SELECTed into a DTO. It is only fetched by `get_user_by_email` for `POST /api/auth/login`, which uses it locally for the bcrypt comparison and never serializes it.

### 7.2 Wildcard escaping for search

`q` is trimmed, lowercased, and then run through `_escape_like`:

```python
def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
```

The order matters: backslashes first, then `%`/`_`. The query then uses plain `LIKE` against `lower(email)` / `lower(name)` (Postgres's default LIKE escape is `\`), so a search for `100%_off` does NOT match every row — it matches only the literal characters `100%_off`.

The pre-existing trigram GIN indexes (`idx_users_email_trgm`, `idx_users_name_trgm`) on `lower(email::text)` / `lower(name::text)` are used by Postgres for `lower(...) LIKE '%...%'` patterns, so search benefits at scale without any new DDL by this phase.

### 7.3 Transactions

`PATCH` and `DELETE` perform their consistency checks (`SELECT … FOR UPDATE`, the email-uniqueness `SELECT`, and the last-admin `count(*)`) and the write inside a single psycopg2 transaction. `commit()` runs only after all checks pass; otherwise `rollback()` runs explicitly before returning the error.

### 7.4 Authorization model (this phase)

Per TECH_SPEC §7.1, any authenticated user can call any `/api/users/...` endpoint — no role gate beyond having a valid JWT. The seeded user is `role = 'admin'`. If a stricter "role must be admin" rule is desired later, it would be a one-line `if user["role"] != "admin": raise StarletteHTTPException(403, ...)` added to each handler — no schema change needed.

### 7.5 Setup notes (called out by DB_SCHEMA.md §6)

- `core/database.py` line 19: default password changed from `"postgres"` to `"1234"` to match the local Postgres password documented in `DB_SCHEMA.md` §2.
- `core/seed.py`: extended idempotently to produce the live shape on a fresh DB (`name text NOT NULL`, `role text NOT NULL DEFAULT 'user'`, `users_role_check`) and to write `name='Admin'` / `role='admin'` for the seeded admin. The admin upsert preserves a hand-edited name (`COALESCE(NULLIF(name,''), 'Admin')`) so re-running the seed does not clobber a renamed admin.

### 7.6 Out of scope (mirrors PROTOTYPE §6 / TECH_SPEC §11)

- No `GET /api/users/{id}` single-fetch endpoint (TECH_SPEC §5.6 marked it optional; front-end does not need it for this phase).
- No password reset / forgot-password flow.
- No soft delete; `DELETE` is final.
- No audit trail.
- No granular per-resource permissions.

---

## 8. Verification

### 8.1 Existing pytest suite

`cd core && python3 -m pytest tests/` passes (14/14 — the existing `test_auth.py` is unchanged and all login tests still pass).

### 8.2 End-to-end smoke (against live DB)

A scripted run with `fastapi.testclient.TestClient` against `localhost:5432/postgres` (password `1234`) covers, in this order:

1. Login as seeded admin → 200, gets JWT.
2. `GET /api/users` with no header / malformed header / wrong scheme → 401 `"Not authenticated"`.
3. `GET /api/users` → 200, items + pagination present, no `password_hash` / `$2b$` in body.
4. `GET /api/users?q=admin&page=1&limit=5` → 200.
5. `GET /api/users?page=0` → 422 `data.errors.page = "Page must be a positive integer"`.
6. `GET /api/users?limit=0` → 422 `data.errors.limit = "Limit must be between 1 and 100"`.
7. `POST /api/users` with valid body → 201, DTO returned, no password leaked.
8. `POST /api/users` with empty fields → 422 with `email`/`name`/`password` errors.
9. `POST /api/users` with bad email / bad role / short password → 422 with the three field-keyed messages.
10. `POST /api/users` with duplicate email → 422 `email = "Email already in use"`, `message = "Email already in use"`.
11. New user logs in via `POST /api/auth/login` → 200 (proves password hash is correct end-to-end).
12. `PATCH /api/users/{id}` renaming → 200, name updated.
13. `PATCH /api/users/{id}` resetting password → 200; old password → 401, new password → 200.
14. `PATCH /api/users/{nonexistent-uuid}` → 404 `"User not found"`.
15. `PATCH /api/users/not-a-uuid` → 404 `"User not found"`.
16. `PATCH /api/users/{id}` with `{}` → 422 `data.errors._ = "No changes provided"`.
17. `PATCH /api/users/{seed-admin}` with `role=user` → 422 `role = "Cannot remove the last administrator"`, `message = "Cannot remove the last administrator"`.
18. `DELETE /api/users/{seed-admin}` from seed admin's session → 400 `"You cannot delete your own account"`.
19. `DELETE /api/users/{nonexistent}` → 404 `"User not found"`.
20. `DELETE /api/users/{newly-created}` → 200, then logging in as that user → 401 (proves hard delete).
21. Two-admin manoeuvre: promote a second user to admin, demote seed admin to user (via second admin's JWT — succeeds because two admins exist), then `DELETE /api/users/{second-admin}` from seed-admin's session → 400 `"Cannot remove the last administrator"`. Cleanup restores seed admin's `role='admin'`.
22. Final state of seeded admin reverified via `GET /api/users?q=admin@example.com` → `role='admin'`.

All 22 scenarios pass. The seeded admin row is identical before and after the smoke run.
