# Backend API — Login Page

**Task:** `.tasks/login-page`
**Source:** `PROTOTYPE.md`, `TECH_SPEC.md` §4 / §5 / §8, `DB_SCHEMA.md` §3
**Audience:** frontend-developer, qa-tester, reviewer
**Implemented in:** `core/main.py`, `core/database.py`, `core/seed.py`
**Branch:** `develop-blank-project`

This document is the ready-to-consume API contract for the login endpoint as
implemented in `core/`. Every shape below is exercised by unit tests in
`core/tests/test_auth.py` and matches the live endpoint.

---

## 1. Endpoint

`POST http://localhost:8000/api/auth/login`

| Aspect           | Value |
|------------------|-------|
| Method           | `POST` |
| URL              | `/api/auth/login` |
| Request headers  | `Content-Type: application/json` |
| Auth required    | **No** (public endpoint) |
| CORS             | `http://localhost:3000` only (credentials allowed, all methods/headers) |
| Rate limiting    | Not implemented this phase (out of scope per PROTOTYPE §4) |

The FastAPI app runs from `core/main.py` (`uvicorn main:app --reload` from
inside `core/` with the venv active). There are no other routes yet.

---

## 2. Request body

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

| Field      | Type   | Required | Rules (server-enforced, see §4) |
|------------|--------|----------|---------------------------------|
| `email`    | string | yes      | Trimmed + lowercased server-side. Must be non-empty, ≤ 254 chars, and match `^[^\s@]+@[^\s@]+\.[^\s@]+$`. |
| `password` | string | yes      | Non-empty, ≥ 8 chars, ≤ 128 chars. Never logged or echoed back. |

Additional fields in the body are ignored.

---

## 3. Responses

Every response uses the envelope `{ success, data, message }`.

### 3.1 `200 OK` — Successful login

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "b38adc71-3ae1-4a7b-befc-0bf98ee77ca7",
      "email": "admin@example.com"
    }
  },
  "message": "Login successful"
}
```

- `token` — HS256-signed JWT (see §5).
- `user` — minimal DTO, only `id` (string UUID) and `email` (lowercased).
  Never contains `password_hash` or timestamps.

### 3.2 `401 Unauthorized` — Invalid credentials

Same body whether the email is unknown **or** the password is wrong. Callers
must not try to distinguish the two cases.

```json
{
  "success": false,
  "data": null,
  "message": "Invalid email or password"
}
```

### 3.3 `422 Unprocessable Entity` — Validation failure

Returned when Pydantic validation rejects the request body. Only the fields
that failed appear in `errors`, each with a single user-safe message.

```json
{
  "success": false,
  "data": {
    "errors": {
      "email": "Email is required",
      "password": "Password must be at least 8 characters"
    }
  },
  "message": "Validation failed"
}
```

Exhaustive per-field message table (matches TECH_SPEC §5):

| Field      | Condition triggering the error           | Error message                          |
|------------|------------------------------------------|----------------------------------------|
| `email`    | Missing / empty / whitespace-only        | `Email is required`                    |
| `email`    | Length > 254                             | `Email is too long`                    |
| `email`    | Fails RFC-lite regex                     | `Enter a valid email address`          |
| `password` | Missing / empty                          | `Password is required`                 |
| `password` | Length < 8                               | `Password must be at least 8 characters` |
| `password` | Length > 128                             | `Password is too long`                 |

### 3.4 `500 Internal Server Error` — Unexpected server-side failure

Defensive fallback via a global `Exception` handler. The frontend should treat
this (and any non-200/401/422) as the "backend unreachable" case per
TECH_SPEC §3.8.

```json
{
  "success": false,
  "data": null,
  "message": "Internal server error"
}
```

---

## 4. Validation rules (server-side, authoritative)

Defined on the Pydantic `LoginRequest` model with `validate_default=True` so
missing fields still flow through the validators and yield
`"Email/Password is required"` rather than Pydantic's generic "Field required".

### 4.1 Email

1. Required, non-blank after trim.
2. Length ≤ 254.
3. Matches `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
4. **Normalized to `value.strip().lower()` before any DB lookup or JWT claim.**

### 4.2 Password

1. Required, non-empty.
2. Length in `[8, 128]`.
3. **Never** logged, echoed, or returned; never reaches the response payload.

---

## 5. JWT payload

Tokens are signed with **HS256** using the `JWT_SECRET` environment variable
(falls back to a dev placeholder if unset — production MUST set a real secret).

| Claim  | Type    | Value                                             |
|--------|---------|---------------------------------------------------|
| `sub`  | string  | The user's UUID (`users.id`, stringified).        |
| `email`| string  | The user's normalized email (lowercased).         |
| `exp`  | number  | UNIX timestamp, issued-time + 60 minutes (UTC).   |

No other claims are included in this phase. Token expiry matches
TECH_SPEC §8.1 (60 minutes).

---

## 6. Backend behavior (informative)

1. Parse JSON body → `LoginRequest` (Pydantic). On failure → custom 422 handler
   reshapes FastAPI's `RequestValidationError` into the §3.3 envelope.
2. Email is trimmed + lowercased by the Pydantic validator before the handler
   sees it.
3. `get_user_by_email(email)` runs
   `SELECT id, email, password_hash FROM users WHERE lower(email) = %s`
   against the pool in `core/database.py`.
4. If the user is missing **or** `bcrypt.checkpw(password, password_hash)`
   returns false → identical 401 (no enumeration).
5. On success, a JWT is built (see §5) and the 200 envelope is returned.
6. Any unhandled exception → 500 envelope (never leaks a stack trace).

### 6.1 Data source

- Table: `public.users` per `DB_SCHEMA.md` §3.
- Unique index `users_email_key` on `lower(email)` backs the lookup.
- Seeded admin row (`admin@example.com` / `password123`) is created by
  `core/seed.py` — **must be run once** before AC-3 can pass
  (`cd core && source venv/bin/activate && python seed.py`).

---

## 7. CORS

Configured via `fastapi.middleware.cors.CORSMiddleware` in `core/main.py`:

| Option             | Value |
|--------------------|-------|
| `allow_origins`    | `["http://localhost:3000"]` |
| `allow_credentials`| `True` |
| `allow_methods`    | `["*"]` |
| `allow_headers`    | `["*"]` |

Any other origin receives no CORS headers and the browser blocks the request.
Frontend must issue the login request from `http://localhost:3000`.

---

## 8. Security notes (enforced)

- Passwords are compared via `bcrypt.checkpw` — plaintext never touches the
  DB, never appears in response bodies, never goes into logs.
- 401 body is byte-identical for unknown-email vs wrong-password (user
  enumeration defense).
- `user` DTO is a whitelist `{ id, email }`; `password_hash` and timestamps
  are never selected into the response.
- JWT secret must be overridden via `JWT_SECRET` env var in non-dev
  environments. HS256 + 60-minute expiry are non-negotiable for this phase.
- Observability: handler logs no request bodies and no credential fragments.

---

## 9. Test coverage

`core/tests/test_auth.py` — 12 tests, all passing:

| Test                                                      | Asserts                                                   |
|-----------------------------------------------------------|-----------------------------------------------------------|
| `test_login_success_returns_200_envelope_with_token_and_user` | 200 envelope shape, JWT claims (`sub`, `email`, `exp`). |
| `test_login_success_never_leaks_password_hash`            | `password_hash` / bcrypt prefix absent from response text. |
| `test_login_normalizes_email_before_lookup`               | Handler passes `admin@example.com` to lookup for `" ADMIN@Example.COM "`. |
| `test_login_unknown_email_returns_401_generic`            | 401 + exact generic body. |
| `test_login_wrong_password_returns_401_generic`           | 401 + exact generic body. |
| `test_401_bodies_are_identical_for_unknown_and_wrong`     | 401 bodies byte-identical across both arms. |
| `test_422_on_missing_email`                                | Missing `email` → 422 + `Email is required`. |
| `test_422_on_empty_email`                                  | `"   "` → 422 + `Email is required`. |
| `test_422_on_invalid_email_format`                         | `not-an-email` → 422 + `Enter a valid email address`. |
| `test_422_on_short_password`                               | `"short"` → 422 + `Password must be at least 8 characters`. |
| `test_422_on_empty_password`                               | `""` → 422 + `Password is required`. |
| `test_422_collects_errors_for_multiple_fields`             | Both fields invalid → both errors present. |

Run: `cd core && source venv/bin/activate && pytest -v`.

Tests stub `main.get_user_by_email` via `monkeypatch`, so they do **not**
require a live PostgreSQL instance.

---

## 10. Example cURL (live-verified)

```bash
# 200 — happy path (requires seed row to exist)
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'

# 401 — wrong password or unknown email (identical body)
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"wrongpass"}'

# 422 — validation failure
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email","password":"x"}'
```

---

## 11. Downstream handoff

- **frontend-developer:** Consume `/api/auth/login` per §2, §3. On 200 store
  `token` + JSON-stringified `user` in `localStorage` and navigate to
  `/dashboard`. On 401 render the generic banner and clear the password
  field. On 422 render per-field errors under each input using the keys in
  §3.3. On anything else show the network-failure banner.
- **qa-tester:** Seed script must be run once before AC-3. All §3 envelopes
  are asserted in the pytest suite and should be re-asserted at the HTTP
  layer via Playwright.
- **reviewer:** §8 lists the security-relevant invariants; §9 is the
  executable evidence.
