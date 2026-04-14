# BACKEND_API.md — Admin Panel Core API

**Version:** 1.0
**Date:** 2026-04-14
**Author:** Backend Developer Agent
**Sources:** `PROTOTYPE.md` v1.0, `TECH_SPEC.md` v1.0, `DB_SCHEMA.md` v1.0 (all approved 2026-04-14)
**Scope:** `core/`
**Status:** Draft — pending user review

---

## 1. Overview

The Core API is a FastAPI service that backs the Admin Panel. This document
describes every endpoint currently implemented in `core/main.py`. The only
endpoint in scope for this iteration is `POST /api/auth/login`.

- **Base URL (dev):** `http://localhost:8000`
- **Interactive docs:** `http://localhost:8000/docs` (Swagger UI) and `/redoc`
- **CORS:** only `http://localhost:3000` is allowed in local dev (TECH_SPEC §7).

## 2. Response Envelope

Every endpoint, success or failure, returns the same JSON envelope:

```json
{ "success": true | false, "data": object | null, "message": "string" }
```

- `success` — boolean outcome flag.
- `data` — payload on success, `null` on failure.
- `message` — human-readable, non-sensitive message.

HTTP status conventions:

| Status | Meaning                                      |
|--------|----------------------------------------------|
| `200`  | Success.                                     |
| `401`  | Authentication failure (generic).            |
| `422`  | Request validation failure.                  |

All responses carry `Cache-Control: no-store`.

## 3. Authentication

- Authenticated endpoints expect the JWT issued by `POST /api/auth/login` in
  the `Authorization: Bearer <token>` header. *(No protected endpoints are
  implemented in this iteration.)*
- JWT parameters:
  - Algorithm: `HS256`
  - Claims: `sub` (user id), `email`, `iat`, `exp`
  - Lifetime: 60 minutes from issue
  - Secret: backend-side configuration (`SECRET_KEY` in `core/main.py`;
    production deployments MUST override it).

## 4. Endpoints

### 4.1 `POST /api/auth/login`

Authenticate an administrator and issue a JWT session token. Implements
TECH_SPEC §5.2.

- **Auth required:** No
- **Content-Type:** `application/json`
- **Rate limiting / lockout:** out of scope for this iteration.

#### Request body

| Field      | Type     | Required | Constraints                                        |
|------------|----------|----------|----------------------------------------------------|
| `email`    | string   | yes      | Valid email format (Pydantic `EmailStr`).          |
| `password` | string   | yes      | Length 6–255 characters.                           |

Example:

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

#### Responses

**`200 OK` — Successful login**

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "8c9f0e2e-7a19-4e8c-b9ad-2a7e6f4d1d4a",
      "email": "admin@example.com"
    }
  },
  "message": "Login successful"
}
```

**`401 Unauthorized` — Invalid credentials**

Returned for all three of these cases with the *identical* message, so the
client cannot infer which part of the credential pair was wrong:

- Email does not exist.
- Password does not match the stored bcrypt hash.
- Matching user exists but has `is_active = FALSE`.

```json
{
  "success": false,
  "data": null,
  "message": "Invalid email or password"
}
```

**`422 Unprocessable Entity` — Validation failure**

Returned when the request body is missing a field, has the wrong type, has a
malformed email, or has a password outside the allowed length range.

```json
{
  "success": false,
  "data": null,
  "message": "Invalid email or password format."
}
```

#### Behavior

1. The request body is validated by Pydantic (`LoginRequest`). Any validation
   failure short-circuits with `422` and does not touch the database.
2. The email is lowercased; the lookup is
   `SELECT … FROM users WHERE LOWER(email) = %s` (DB_SCHEMA §8).
3. The submitted password is compared to `password_hash` using
   `bcrypt.checkpw`. Plaintext passwords are never stored or logged
   (TECH_SPEC §7, DB_SCHEMA §8).
4. Unknown email, wrong password, and `is_active = FALSE` all return the same
   generic `401` envelope above.
5. On success, a JWT is created with `create_access_token(user_id, email)`
   (HS256, 60-minute expiry) and returned along with the public user object.
6. Every response sets `Cache-Control: no-store`.

## 5. Error Handling

- Pydantic `RequestValidationError` is caught by a global handler that
  returns `422` with the envelope `{"success": false, "data": null,
  "message": "Invalid email or password format."}`.
- Unhandled exceptions fall back to FastAPI defaults and should be treated as
  bugs; they will not occur on the documented happy or unhappy paths.

## 6. Data Model (Summary)

Backed by the `users` table defined in `DB_SCHEMA.md` §4.1:

| Column          | Type           | Used by login? | Notes                                 |
|-----------------|----------------|----------------|---------------------------------------|
| `id`            | `uuid`         | yes (JWT sub)  | Returned as `user.id`.                |
| `email`         | `varchar(255)` | yes            | Lookup key, lowercased storage.       |
| `password_hash` | `varchar(255)` | yes            | bcrypt hash; never echoed back.       |
| `is_active`     | `boolean`      | yes            | `FALSE` rejected as generic `401`.    |
| `created_at`    | `timestamptz`  | no             | Audit timestamp.                      |
| `updated_at`    | `timestamptz`  | no             | Audit timestamp (trigger-maintained). |

## 7. Configuration

Environment variables read at startup (defaults in parentheses):

| Variable       | Default     | Purpose                                  |
|----------------|-------------|------------------------------------------|
| `DB_HOST`      | `localhost` | PostgreSQL host.                         |
| `DB_PORT`      | `5432`      | PostgreSQL port.                         |
| `DB_NAME`      | `postgres`  | PostgreSQL database.                     |
| `DB_USER`      | `postgres`  | PostgreSQL user.                         |
| `DB_PASSWORD`  | `postgres`  | PostgreSQL password.                     |

`SECRET_KEY`, `JWT_ALGORITHM`, and `JWT_EXPIRE_MINUTES` live in
`core/main.py`. In production the secret MUST be overridden.

## 8. Running Locally

```bash
cd core
source venv/bin/activate
pip install -r requirements.txt
python seed.py                  # creates schema + seeds admin user
uvicorn main:app --reload       # → http://localhost:8000
```

Seeded admin user:

- **email:** `admin@example.com`
- **password:** `password123`

## 9. Out of Scope (Explicitly Deferred)

Listed so downstream agents do not plan for them in this iteration
(TECH_SPEC §5.3):

- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/refresh`
- `GET  /api/auth/me`

---

**Next step:** Please review this document and the implementation in
`core/main.py` / `core/seed.py`, then approve or request changes.
