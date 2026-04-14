# Account Page — Backend API

**Document type:** Implemented API reference
**Status:** Draft — pending user review before frontend starts
**Author:** Backend Developer Agent
**Date:** 2026-04-14
**Source:** `PROTOTYPE.md`, `TECH_SPEC.md`, `DB_SCHEMA.md` (all approved 2026-04-14)
**Scope:** `core/` only. Frontend is untouched.
**Branch:** `develop-test-3`

---

## 1. Summary

Implements the six routes in TECH_SPEC §5 plus the login change in §5.6, and renames the existing `display_name` column / API field to `name` per DB_SCHEMA §6.

New routes:
- `GET    /api/accounts` — list with search/filter/pagination
- `GET    /api/accounts/{id}` — fetch one account
- `POST   /api/accounts` — create an account
- `PATCH  /api/accounts/{id}` — partial edit (name, email)
- `PATCH  /api/accounts/{id}/status` — activate / deactivate with self-protection

Modified:
- `POST /api/auth/login` — now returns `401 "Account is inactive"` for inactive users instead of a generic credential error.
- `/api/account/me` (session profile) — field renamed `display_name` → `name`, length raised to 1–100.

All routes share the existing envelope: `{ "success": boolean, "data": object|null, "message": string }`.
All responses set `Cache-Control: no-store`.

---

## 2. Authentication

Every `/api/accounts*` route requires a valid, unexpired JWT:

```
Authorization: Bearer <token>
```

Missing / malformed / expired / unknown-sub / inactive-user token →
`401 { "success": false, "data": null, "message": "Not authenticated" }`.

Identity for self-protection: the admin's `id` is the JWT `sub` claim (set by `POST /api/auth/login`).

No role check beyond "logged in" (TECH_SPEC §7, scope decision #3).

---

## 3. Shared DTOs

### 3.1 `User`

Returned by every account endpoint. `password_hash` is **never** serialised.

```json
{
  "id":         "uuid",
  "email":      "jane@example.com",
  "name":       "Jane Doe",
  "is_active":  true,
  "created_at": "2026-04-14T10:00:00Z",
  "updated_at": "2026-04-14T10:00:00Z"
}
```

### 3.2 Envelope

```json
{ "success": true|false, "data": <User|List|null>, "message": "..." }
```

### 3.3 Validation errors

Validation failures (422) attach per-field messages:

```json
{
  "success": false,
  "data":    { "errors": { "email": "…", "password": "…" } },
  "message": "Validation failed"
}
```

---

## 4. Endpoints

### 4.1 `GET /api/accounts`

List accounts, paginated and filterable.

| Field         | Auth | Notes |
|---------------|------|-------|
| Method        | GET  | |
| Path          | `/api/accounts` | |
| Auth          | JWT required | |

**Query params**

| Name        | Type    | Default | Rules                                                      |
|-------------|---------|---------|------------------------------------------------------------|
| `q`         | string  | `null`  | Trimmed; empty treated as unset; max 100 chars. Substring match on `name` **or** `email`, case-insensitive. |
| `status`    | string  | `all`   | One of `active`, `inactive`, `all`.                        |
| `page`      | integer | `1`     | ≥ 1.                                                       |
| `page_size` | integer | `20`    | 1–100.                                                     |

**200** — page of results:

```json
{
  "success": true,
  "data": {
    "items":     [ /* User */ ],
    "page":      1,
    "page_size": 20,
    "total":     135
  },
  "message": ""
}
```

Ordering: `created_at DESC, id DESC`.

**Errors**

| Status | When | Body |
|--------|------|------|
| `401`  | No / bad token | `{success:false, data:null, message:"Not authenticated"}` |
| `422`  | Invalid `status`, `q` too long, or FastAPI-level coercion failure on `page`/`page_size` | `{success:false, data:{errors:{…}}, message:"Validation failed"}` |

---

### 4.2 `GET /api/accounts/{id}`

Fetch a single account.

| | |
|-|-|
| Method | GET |
| Path | `/api/accounts/{id}` |
| Auth | JWT required |

**Path params** — `id` (string). Non-UUID values are treated as not-found.

**200** — `{ "success": true, "data": <User>, "message": "" }`

**Errors**

| Status | When | Message |
|--------|------|---------|
| `401`  | No / bad token | `Not authenticated` |
| `404`  | No user with that id (or id not a UUID) | `Account not found` |

---

### 4.3 `POST /api/accounts`

Create an account.

| | |
|-|-|
| Method | POST |
| Path | `/api/accounts` |
| Auth | JWT required |

**Request body**

```json
{
  "name":      "Jane Doe",
  "email":     "jane@example.com",
  "password":  "secret123",
  "is_active": true
}
```

| Field       | Required | Rule |
|-------------|----------|------|
| `name`      | yes      | Trimmed length 1–100; no control chars; Unicode-NFC-normalized. |
| `email`     | yes      | RFC-5322 email; stored lowercased; unique on `lower(email)`.    |
| `password`  | yes      | 8–128 chars; must contain at least one letter and one digit.    |
| `is_active` | no       | Defaults to `true`.                                             |

**201** — created user:

```json
{ "success": true, "data": <User>, "message": "Account created" }
```

**Errors**

| Status | When | Message |
|--------|------|---------|
| `401`  | No / bad token | `Not authenticated` |
| `409`  | Duplicate email (case-insensitive) | `An account with this email already exists` |
| `422`  | Field validation failed | `Validation failed` (per-field in `data.errors`) |

---

### 4.4 `PATCH /api/accounts/{id}`

Partial update of `name` and/or `email`. At least one field must be supplied.

| | |
|-|-|
| Method | PATCH |
| Path | `/api/accounts/{id}` |
| Auth | JWT required |

**Request body** (both fields optional, at least one required):

```json
{ "name": "Jane D.", "email": "jane.d@example.com" }
```

Same validation rules as create for the fields that are present. Fields omitted from the body are not touched.

**200** — updated user:

```json
{ "success": true, "data": <User>, "message": "Changes saved" }
```

**Errors**

| Status | When | Message |
|--------|------|---------|
| `401`  | No / bad token | `Not authenticated` |
| `404`  | No user with that id (or id not a UUID) | `Account not found` |
| `409`  | New email collides with another user (case-insensitive) | `An account with this email already exists` |
| `422`  | No fields supplied / field validation failed | `No changes submitted` or `Validation failed` |

---

### 4.5 `PATCH /api/accounts/{id}/status`

Activate or deactivate an account.

| | |
|-|-|
| Method | PATCH |
| Path | `/api/accounts/{id}/status` |
| Auth | JWT required |

**Request body**

```json
{ "is_active": false }
```

**Self-protection:** if `id == <authenticated user id>` and `is_active` is `false`, the request is rejected with `403` before any DB write.

**200** — updated user. `message` is `"Account activated"` or `"Account deactivated"`.

**Errors**

| Status | When | Message |
|--------|------|---------|
| `401`  | No / bad token | `Not authenticated` |
| `403`  | Admin tried to deactivate their own account | `You cannot deactivate your own account` |
| `404`  | No user with that id (or id not a UUID) | `Account not found` |
| `422`  | `is_active` missing or non-boolean | `Validation failed` |

---

### 4.6 `POST /api/auth/login` (updated)

Unchanged request shape:

```json
{ "email": "admin@example.com", "password": "password123" }
```

**200** — issues a JWT:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user":  { "id": "<uuid>", "email": "admin@example.com" }
  },
  "message": "Login successful"
}
```

**Error behaviour (updated):** password is checked **before** the `is_active` flag, so that knowing whether an email is active or inactive requires the correct password.

| Status | When | Message |
|--------|------|---------|
| `401`  | Unknown email or wrong password | `Invalid email or password` |
| `401`  | Correct credentials but user is inactive | `Account is inactive` |
| `422`  | Bad email format / password under 6 chars | `Invalid email or password format.` |

---

## 5. Validation rules (concrete)

| Field       | Implemented in `core/main.py` as |
|-------------|-----------------------------------|
| `email`     | Pydantic `EmailStr` + lowercase + case-insensitive uniqueness (index `users_email_lower_key`) |
| `name`      | Trim → reject control chars → 1–100 codepoints → NFC-normalize |
| `password`  | 8–128 chars; `[A-Za-z]` and `[0-9]` regex checks |
| `q`         | Trim; empty becomes unset; max 100 chars |
| `status`    | Lowercased; must be `active`, `inactive`, or `all` |
| `page`      | `Query(ge=1)` |
| `page_size` | `Query(ge=1, le=100)` |
| `is_active` | Pydantic `bool` |

---

## 6. Security notes

- `password_hash` is never included in any SELECT used to build `User` DTOs (`ACCOUNT_SELECT_COLUMNS` is `id, email, name, is_active, created_at, updated_at`).
- Responses set `Cache-Control: no-store`.
- JWT secret and expiry unchanged (`SECRET_KEY`, 60 min).
- CORS unchanged (allows `http://localhost:3000` only).
- Inactive users are rejected by `get_current_user` as well, so a previously-issued token stops working immediately after deactivation.

---

## 7. Smoke tests run against `localhost:8000`

All passed on 2026-04-14 with the migrated DB:

1. Missing token on any `/api/accounts*` → `401 Not authenticated`. ✅
2. `GET /api/accounts` → 200, returns seeded users (`admin@example.com`, `tester@example.com`). ✅
3. `GET /api/accounts?q=admin&status=active&page=1&page_size=10` → 200, single row. ✅
4. `POST /api/accounts` with valid body → `201`, returned User shape matches §3.1. ✅
5. `POST /api/accounts` with `JANE@…` after creating `jane@…` → `409` duplicate. ✅
6. `POST /api/accounts` with password `"short"` → `422`, per-field error. ✅
7. `POST /api/accounts` with `email="not-an-email"` → `422`, per-field error. ✅
8. `GET /api/accounts/<bad-uuid>` → `404` (not a 500). ✅
9. `GET /api/accounts/<zeros-uuid>` → `404`. ✅
10. `PATCH /api/accounts/{id}` name-only → `200 "Changes saved"`. ✅
11. `PATCH /api/accounts/{id}` colliding email → `409`. ✅
12. `PATCH /api/accounts/{id}/status {is_active:false}` on Jane → `200 "Account deactivated"`. ✅
13. `POST /api/auth/login` as Jane after deactivation → `401 "Account is inactive"`. ✅
14. `PATCH /api/accounts/{admin_id}/status {is_active:false}` as admin → `403 "You cannot deactivate your own account"`. ✅
15. `PATCH /api/accounts/{id}/status {is_active:true}` to reactivate → `200 "Account activated"`. ✅

---

## 8. Files changed

- `core/main.py` — renamed `display_name` → `name`; widened name validation 1–60 → 1–100; added `/api/accounts*` router block; added inactive-user path to `POST /api/auth/login`.
- `core/seed.py` — added `name varchar(100) NOT NULL` to `CREATE TABLE`, added `pg_trgm` extension, added `users_email_lower_key` (case-insensitive unique index) and supporting indexes, updated upsert to include `name = 'Administrator'`.

No files under `admin/` were modified.

---

## 9. Out of scope

Per TECH_SPEC §9: no hard delete, no admin-driven password reset, no RBAC, no audit-log surface, no bulk operations, no MFA/impersonation. Frontend wiring is delegated to `frontend-developer` in Phase 4.
