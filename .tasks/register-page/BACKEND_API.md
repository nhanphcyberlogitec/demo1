# BACKEND_API — Register Page

> Backend contract for the register feature. Derived from `PROTOTYPE.md`, `TECH_SPEC.md §5.1`, and `DB_SCHEMA.md`. Verified against live Postgres on 2026-04-17. Owner: backend-developer.

---

## 1. Summary

One new endpoint added to `core/main.py`:

- **`POST /api/auth/register`** — public self-signup. Creates a new `users` row with `is_active = TRUE`, returns a JWT + the new user object (same shape as login success) so the client can auto-login.

Supporting changes (same file):

- New Pydantic model: `RegisterRequest`.
- `validation_exception_handler` extended so `path == "/api/auth/register"` routes through `_field_errors_from_pydantic` (field-error envelope). `/api/auth/login` behavior is unchanged.

No other endpoints changed. No DB migrations. No new dependencies.

---

## 2. Endpoint: `POST /api/auth/register`

- **Auth**: none (public). Does not call `get_current_user`. No `Authorization` header is read.
- **Request `Content-Type`**: `application/json`.
- **Response `Content-Type`**: `application/json`.
- **Headers on every response**: `Cache-Control: no-store` (`NO_STORE_HEADERS`).
- **CORS**: covered by the existing middleware allowing `http://localhost:3000`.

### 2.1 Request body

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "hunter2abc",
  "confirm_password": "hunter2abc"
}
```

| Field              | Type   | Required | Notes                                                                                |
|--------------------|--------|----------|--------------------------------------------------------------------------------------|
| `name`             | string | yes      | Trimmed + NFC-normalized server-side. 1–100 chars after trim. No control characters. |
| `email`            | string | yes      | Pydantic `EmailStr`. Stored lowercased + trimmed.                                    |
| `password`         | string | yes      | 8–128 chars. Must contain at least one letter AND one digit. Never echoed back.      |
| `confirm_password` | string | yes      | Must equal `password` exactly (case-sensitive). Never echoed back.                   |

Unknown fields are ignored (`model_config = {"extra": "ignore"}`).

### 2.2 Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": "<uuid>", "email": "jane@example.com" }
  },
  "message": "Account created"
}
```

- `token` — HS256 JWT, 60-minute expiry, `sub = user.id`, `email` claim (same `create_access_token` helper as login).
- `user.id` — UUID, from `gen_random_uuid()` via `RETURNING id`.
- `user.email` — lowercased stored value (matches what is persisted).
- Message is exactly `"Account created"`.
- Response shape mirrors `POST /api/auth/login` so the client's auth-bootstrap logic can be reused without changes.

### 2.3 Validation failure — `422 Unprocessable Entity`

```json
{
  "success": false,
  "data": {
    "errors": {
      "name": "Name is required",
      "email": "value is not a valid email address: An email address must have an @-sign.",
      "password": "Password must contain at least one letter and one digit",
      "confirm_password": "Passwords do not match"
    }
  },
  "message": "Validation failed"
}
```

Rules for which key(s) appear in `errors`:

- Only the failing keys are included.
- **Pydantic-level failures** (missing field, wrong type, invalid `EmailStr`) come through the extended `validation_exception_handler` — one key per failing field, `message = "Validation failed"`.
- **App-level failures** (from `_validate_name`, `_validate_password`, confirm-mismatch, empty-after-trim email) are assembled in the endpoint and returned via `_validation_error_response(errors)` with `message = "Validation failed"`.
- **Confirm-mismatch precedence**: `confirm_password` is only set when the password itself is otherwise valid. If the password also fails (length, character classes), only `password` is returned — this matches the `POST /api/account/password` behavior (`core/main.py`) and avoids double-annoying the user.

### 2.4 Duplicate email — `409 Conflict`

```json
{
  "success": false,
  "data": null,
  "message": "An account with this email already exists"
}
```

Triggered both by the pre-insert `SELECT 1 ... WHERE LOWER(email) = %s` check and by catching `psycopg2.errors.UniqueViolation` on the INSERT (race path against the `users_email_lower_key` unique index). Both paths return the exact same envelope.

### 2.5 Unexpected server error — `500 Internal Server Error`

Default FastAPI response. The client treats any non-2xx / non-422 / non-409 as "generic error" and shows `"Something went wrong. Please try again."`.

---

## 3. Error matrix

| # | Cause                                               | HTTP | `success` | `message`                                       | `data`                                      |
|---|-----------------------------------------------------|------|-----------|-------------------------------------------------|---------------------------------------------|
| 1 | Missing / wrong-type field, bad JSON, invalid email | 422  | false     | `"Validation failed"`                           | `{ errors: { <field>: <pydantic-msg> } }`   |
| 2 | Name empty / whitespace / >100 chars / control chars| 422  | false     | `"Validation failed"`                           | `{ errors: { name: "..." } }`               |
| 3 | Password length out of 8–128                        | 422  | false     | `"Validation failed"`                           | `{ errors: { password: "Password must be 8–128 characters" } }` |
| 4 | Password missing letter or digit                    | 422  | false     | `"Validation failed"`                           | `{ errors: { password: "Password must contain at least one letter and one digit" } }` |
| 5 | Confirm mismatch (and password otherwise valid)     | 422  | false     | `"Validation failed"`                           | `{ errors: { confirm_password: "Passwords do not match" } }` |
| 6 | Email already exists (case-insensitive)             | 409  | false     | `"An account with this email already exists"`   | `null`                                      |
| 7 | Unexpected exception                                | 500  | —         | default FastAPI                                 | —                                           |

Notes:

- The 422 field-error envelope is produced by the same handler that serves `/api/account/*` and `/api/accounts*`. The handler was extended to also match `path == "/api/auth/register"`. `/api/auth/login` still returns the legacy `{ success: false, data: null, message: "Invalid email or password format." }` on Pydantic failures — unchanged.
- Passwords are **never** returned in any response body and **never** logged.

---

## 4. Server-side sequence

Source: `core/main.py`, `register()` handler.

1. Parse body → `RegisterRequest`. Missing / malformed fields fall through to `validation_exception_handler` (422 field-error envelope).
2. Build `errors: dict`:
   - `_validate_name(payload.name)` → `errors["name"]` on failure; keeps the normalized name for later.
   - `email_value = str(payload.email).strip().lower()`; if empty → `errors["email"] = "Email is required"`.
   - `_validate_password(payload.password)` → `errors["password"]` on failure.
   - If `"password"` not in `errors` and `payload.password != payload.confirm_password` → `errors["confirm_password"] = "Passwords do not match"`.
3. If `errors` → `_validation_error_response(errors)` (422).
4. `SELECT 1 FROM users WHERE LOWER(email) = %s`. If a row exists → `_duplicate_email_response()` (409).
5. `password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")`.
6. `INSERT INTO users (email, password_hash, name, is_active) VALUES (%s, %s, %s, TRUE) RETURNING id, email`.
   - On `psycopg2.errors.UniqueViolation` → rollback and return `_duplicate_email_response()` (409) — covers the concurrent-insert race.
7. `conn.commit()`, release connection.
8. `token = create_access_token(str(new_id), new_email)`.
9. `logger.info("account.registered id=%s email=%s", new_id_str, new_email)`.
10. Return 200 with `{ token, user: { id, email } }` and message `"Account created"`, with `NO_STORE_HEADERS`.

`created_at`, `updated_at`, `id` are populated by column defaults (`now()`, `gen_random_uuid()`) — never set from Python. `password_hash` is never included in any `RETURNING` clause.

---

## 5. cURL examples

All examples assume the backend is running on `http://localhost:8000`.

### 5.1 Success — 200

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "hunter2abc",
    "confirm_password": "hunter2abc"
  }'
```

Response:

```
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{"success":true,"data":{"token":"<jwt>","user":{"id":"<uuid>","email":"jane@example.com"}},"message":"Account created"}
```

### 5.2 Duplicate email — 409

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "Jane@Example.com",
    "password": "hunter2abc",
    "confirm_password": "hunter2abc"
  }'
```

Response:

```
HTTP/1.1 409 Conflict
cache-control: no-store
content-type: application/json

{"success":false,"data":null,"message":"An account with this email already exists"}
```

### 5.3 Confirm mismatch — 422

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane",
    "email": "new@example.com",
    "password": "hunter2abc",
    "confirm_password": "hunter2XYZ"
  }'
```

Response:

```
HTTP/1.1 422 Unprocessable Entity
cache-control: no-store
content-type: application/json

{"success":false,"data":{"errors":{"confirm_password":"Passwords do not match"}},"message":"Validation failed"}
```

### 5.4 Weak password — 422

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane",
    "email": "new@example.com",
    "password": "abcdefghij",
    "confirm_password": "abcdefghij"
  }'
```

Response:

```
HTTP/1.1 422 Unprocessable Entity
cache-control: no-store
content-type: application/json

{"success":false,"data":{"errors":{"password":"Password must contain at least one letter and one digit"}},"message":"Validation failed"}
```

### 5.5 Missing body fields — 422 (Pydantic)

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:

```
HTTP/1.1 422 Unprocessable Entity
cache-control: no-store
content-type: application/json

{"success":false,"data":{"errors":{"name":"Field required","email":"Field required","password":"Field required","confirm_password":"Field required"}},"message":"Validation failed"}
```

### 5.6 Invalid email format — 422 (Pydantic)

```bash
curl -i -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane",
    "email": "not-an-email",
    "password": "hunter2abc",
    "confirm_password": "hunter2abc"
  }'
```

Response:

```
HTTP/1.1 422 Unprocessable Entity
cache-control: no-store
content-type: application/json

{"success":false,"data":{"errors":{"email":"value is not a valid email address: An email address must have an @-sign."}},"message":"Validation failed"}
```

---

## 6. Verification against live Postgres (2026-04-17)

All cURL flows above were executed against `uvicorn main:app --port 8001` backed by the project's `postgres@localhost:5432/postgres` database:

- Happy path → 200 with token + user; row inserted with `is_active = TRUE`, email lowercased, name trimmed, bcrypt hash length 60, UUID from `gen_random_uuid()`.
- Same email in different case → 409 from the pre-check (`LOWER(email)` lookup).
- `POST /api/auth/login` with the mixed-case email + correct password → 200 (end-to-end auto-login works).
- `POST /api/auth/login` with an invalid body → still returns the legacy generic envelope (`message: "Invalid email or password format."`) — unchanged.

Test user (`qa-register-test@example.com`) was deleted after verification.

---

## 7. Out of scope

Not added by this change (per `TECH_SPEC §9`):

- Email verification / confirmation emails.
- Rate limiting / captcha.
- Role assignment (no role column exists).
- Password strength meter backend.
- Welcome email.

---

## 8. Client integration notes (for frontend-developer)

- Success `data` shape is **identical** to `POST /api/auth/login` — reuse the same `localStorage.setItem("token", ...)` / `localStorage.setItem("user", JSON.stringify(...))` logic and the same redirect-to-`/dashboard` path.
- On 422, read `data.errors` and render each key inline next to its input (keys: `name`, `email`, `password`, `confirm_password`). Focus order: Name → Email → Password → Confirm Password.
- On 409, show the form-level banner using the top-level `message`, offer a `Sign in instead` link to `/login`.
- On network failure / 5xx, show a generic `"Something went wrong. Please try again."` banner.
- Per `TECH_SPEC §6` password-clearing rule: on any failed submit (422, 409, network, 5xx), clear both password fields; retain name and email.
