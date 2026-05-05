# Login Page — Backend API Contract (BACKEND_API)

> **Source documents:** `PROTOTYPE.md`, `TECH_SPEC.md` §4–§6, `DB_SCHEMA.md`
> **Implementation:** `core/main.py` (FastAPI 0.135), `core/database.py` (psycopg2 connection pool)
> **Tests:** `core/tests/test_auth.py` (10 cases, all passing against the live seed)

This document is the backend-developer's deliverable. It is the single source of truth for what the frontend can rely on. Anything not documented here is not part of the contract.

---

## 1. Base URL & CORS

| Setting | Value |
|---|---|
| Dev base URL | `http://localhost:8000` |
| CORS allow-origin | `http://localhost:3000` |
| CORS credentials | allowed |
| CORS methods / headers | `*` |

Configured in `core/main.py` via `CORSMiddleware`.

---

## 2. Envelope

Every endpoint returns the same JSON shape:

```json
{ "success": true | false, "data": object | null, "message": "string" }
```

`422` responses additionally include a top-level `errors` array (TECH_SPEC §4.1.4); the three core keys are always present.

---

## 3. Endpoints

### 3.1 `POST /api/auth/login`

Authenticate an admin user and issue a JWT.

**Request**

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Server-side validation** (mirrors TECH_SPEC §5.2 — server is the source of truth)

| Field | Rule | Failure status |
|---|---|---|
| `email` | string, required, trimmed + lowercased before lookup | 422 |
| `email` | matches `^[^\s@]+@[^\s@]+\.[^\s@]+$` | 422 |
| `email` | length ≤ 255 (post-trim) | 422 |
| `password` | string, required (non-empty) | 422 |
| `password` | length ≥ 8 | 422 |
| `password` | length ≤ 128 | 422 |

The body is decoded as JSON before validation; an unparseable body returns `400`, not `422`.

#### 3.1.1 `200 OK` — Success

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "968d63a1-51a0-4b8b-9517-5bd4cf7e2ebf",
      "email": "admin@example.com",
      "name": "Administrator"
    }
  },
  "message": "Login successful"
}
```

| Field | Type | Notes |
|---|---|---|
| `data.token` | string | Signed JWT, HS256, expires 60 minutes after issue |
| `data.token_type` | string | Always `"Bearer"` |
| `data.expires_in` | integer | Token lifetime in **seconds** (always `3600`) |
| `data.user.id` | string (uuid) | Stable identifier; matches JWT `sub` |
| `data.user.email` | string | Lowercased canonical form |
| `data.user.name` | string \| null | Display name (`name` column in `users`) |
| `data.user.password_hash` | — | **Never** returned. Verified internally and dropped. |

#### 3.1.2 `401 Unauthorized` — Bad credentials

Returned for **both** "email not found" and "password mismatch". Body is byte-identical between the two cases — no user enumeration.

```json
{ "success": false, "data": null, "message": "Invalid credentials" }
```

#### 3.1.3 `400 Bad Request` — Malformed JSON / missing body

```json
{ "success": false, "data": null, "message": "Malformed request" }
```

Triggered when the request body is not valid JSON, or `Content-Type` is JSON but the bytes can't be parsed.

#### 3.1.4 `422 Unprocessable Entity` — Validation error

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "errors": [
    { "field": "email",    "message": "Enter a valid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

Field-level messages are **stable strings** the frontend can render verbatim. The full set:

| Field | Message |
|---|---|
| `email` | `"Email is required"` |
| `email` | `"Enter a valid email address"` |
| `email` | `"Email is too long"` |
| `password` | `"Password is required"` |
| `password` | `"Password must be at least 8 characters"` |
| `password` | `"Password is too long"` |

The `errors` array always contains at least one entry. Multiple field failures are reported in a single response.

#### 3.1.5 `500 Internal Server Error` — Unexpected failure

```json
{ "success": false, "data": null, "message": "Internal server error" }
```

Last-resort handler for any uncaught exception (database outage, programming error, etc.). Does **not** leak stack traces; the full traceback is logged server-side under the `admin.auth` logger.

---

## 4. JWT Format

| Aspect | Value |
|---|---|
| Algorithm | `HS256` |
| Secret | `JWT_SECRET_KEY` env var (insecure default exists for local dev — must be overridden in any deployed environment) |
| Lifetime | 60 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES = 60`) |
| Header | `{ "alg": "HS256", "typ": "JWT" }` |

Claims:

| Claim | Type | Value |
|---|---|---|
| `sub` | string | `users.id` as a UUID string — matches `data.user.id` in the 200 body |
| `email` | string | `users.email` (lowercase) |
| `iat` | integer | Issue time, unix seconds |
| `exp` | integer | Expiry, unix seconds. Always equals `iat + 3600` |

Sample decoded payload:

```json
{
  "sub": "968d63a1-51a0-4b8b-9517-5bd4cf7e2ebf",
  "email": "admin@example.com",
  "iat": 1746425920,
  "exp": 1746429520
}
```

The frontend stores the raw token in `localStorage.token` and the user object in `localStorage.user` (TECH_SPEC §6.2).

---

## 5. Endpoints intentionally NOT in this iteration

Reserved per TECH_SPEC §4.2 and acknowledged here so the frontend doesn't accidentally call them:

| Method | Path | Status |
|---|---|---|
| POST | `/api/auth/logout` | Not implemented — client clears localStorage (TECH_SPEC §6.5) |
| GET | `/api/auth/me` | Not implemented |
| POST | `/api/auth/refresh` | Not implemented |
| POST | `/api/auth/forgot-password` | Out of scope (PROTOTYPE §5.2) |

A future iteration may add a shared auth dependency (`Depends(get_current_user)`) once a protected route lands; the JWT format above is stable forward-compatible.

Auxiliary endpoint added for readiness probes only:

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `200 { success: true, data: { status: "ok" }, message: "" }` |

This is not part of the login feature but is useful for the frontend dev server's "is the backend up?" check.

---

## 6. Database Access

- Connection pool: `psycopg2.pool.ThreadedConnectionPool` (min=2, max=10), wrapped in `core/database.py`.
- Credentials read from env vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`); defaults match `DB_SCHEMA.md` §1 for local dev (`localhost:5432`, `postgres`/`postgres`/`1234`).
- The login query is parameterised — no string interpolation:
  ```sql
  SELECT id, email, password_hash, name FROM users WHERE email = %s LIMIT 1
  ```
- Connections are released in `finally` blocks even on error.
- Bcrypt verification (`bcrypt.checkpw`) is the rate-limiting step (~50–100 ms) per `DB_SCHEMA.md` §4.

The schema applied to the live DB has a few extras that DB_SCHEMA.md doesn't enumerate (`is_active boolean`, GIN trigram indexes on `email`/`name`, `auth_audit_log` / `auth_login_attempts` FK targets). The login endpoint **does not depend on any of them** — it reads only `id`, `email`, `password_hash`, `name`. Future endpoints (account lockout, audit) can opt in later without breaking this contract.

---

## 7. Acceptance Mapping

Maps each TECH_SPEC §7.10 backend AC to the test that covers it:

| AC | Description | Covered by |
|---|---|---|
| AC-26 | Valid creds → 200 with documented body | `test_login_success_returns_token_and_user` |
| AC-27 | Wrong password → 401 `"Invalid credentials"` | `test_login_wrong_password_returns_401` |
| AC-28 | Unknown email → identical 401 (no enumeration) | `test_login_unknown_email_returns_same_401` |
| AC-29 | Malformed body → 400; bad email/short pw → 422 with field details | `test_login_malformed_json_returns_400`, `test_login_invalid_email_format_returns_422`, `test_login_short_password_returns_422`, `test_login_missing_fields_returns_422_with_field_errors`, `test_login_empty_email_string_returns_422` |
| AC-30 | JWT decodes with `sub`, `email`, `iat`, `exp`; `exp − iat == 3600` | `test_login_token_decodes_with_required_claims` |

Bonus coverage: `test_login_normalises_email_case_and_whitespace` confirms TECH_SPEC §5.1 client-side normalisation rules are enforced server-side too.

Run the suite from `core/`:

```bash
python3 -m pytest tests/ -v
```

Result at the time of writing: **10 passed, 0 failed.**

---

## 8. cURL Examples

```bash
# 200
curl -i -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'

# 401 (wrong password)
curl -i -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"nope-nope-nope"}'

# 422 (short password)
curl -i -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"short"}'

# 400 (malformed JSON)
curl -i -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{not valid json'
```

---

## 9. Operational Notes for the Frontend Team

1. **Treat 422 messages as display-ready.** They are the canonical strings — do not reword them on the client; that would diverge from the inline-validation messages in TECH_SPEC §2.10.
2. **Treat 401 as the only auth-failure signal.** Render the form-level message `"Invalid email or password. Please try again."` (TECH_SPEC §2.5) regardless of the backend's `message` text — keep that in case backend phrasing changes.
3. **Treat anything else (network drop, 500) as the generic retry message.** TECH_SPEC §2.6.
4. **Do not parse the JWT on the client.** The expiry is in `expires_in` (seconds); use that if you need to schedule a logout timer.
5. **localStorage keys** must be `token` and `user` — matches TECH_SPEC §6.2 and the dashboard auth guard.

---

**Status:** Implemented. All 10 backend tests pass against the live seed. Awaiting user / orchestrator review.
