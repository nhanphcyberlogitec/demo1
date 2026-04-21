# Login Page — Backend API Contract (BACKEND_API.md)

> Source: `.tasks/login-page/TECH_SPEC.md` §5–§11, `.tasks/login-page/DB_SCHEMA.md` §2.1, `.tasks/login-page/PROTOTYPE.md` §4.
> Owner: backend-developer agent.
> Scope: final, shipped contract for `POST /api/auth/login` on branch `develop-login-21042026-v1`.
> Audience: frontend-developer, qa-tester, reviewer.

This document is the **canonical contract** for the v1 login API. It
describes, per status code, the exact request body, response body,
headers, and error copy that the backend will produce. Everything
here is enforced by tests in `core/tests/test_auth.py` (16 cases,
all green).

---

## 1. Endpoint surface (v1)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate an administrator by email + password; return a JWT. |

No other endpoints are part of v1. TECH_SPEC §5.2 reserves
`POST /api/auth/logout` and `GET /api/auth/me` as **future** contracts;
they are **not** implemented in this release.

**Base URL (dev):** `http://localhost:8000`
**CORS:** allows origin `http://localhost:3000` only.
**Content-Type:** all requests and responses are `application/json; charset=utf-8`.

---

## 2. Envelope

Every response — success **and** error — is shaped as:

```json
{ "success": true | false, "data": <object> | null, "message": "<string>" }
```

- `success` — always a boolean.
- `data` — object on success (200), `null` on every error status.
- `message` — string; empty string (`""`) on success, human-readable on error.

Enforced by `test_every_response_follows_envelope` (parametrized over
200 / 401 / 422).

---

## 3. `POST /api/auth/login`

### 3.1 Request

**Headers**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` (required) |

**Body**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Rules applied to the body (in this exact order — see §3.4):

| # | Rule | Notes |
|---|---|---|
| 1 | Request body must be valid JSON | If parsing fails → `422` `"Invalid request body"`. |
| 2 | Body must be a JSON **object** | Arrays / primitives / `null` → `422` `"Invalid request body"`. |
| 3 | `email` present, string, non-blank after trim | Missing / empty / non-string → `422` `"Email is required"`. |
| 4 | `email` length ≤ 255 and matches RFC-5322-ish pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$` | Backend trims and lowercases before validating. Mismatch → `422` `"Email is invalid"`. |
| 5 | `password` present, string, length ≥ 1 | Missing / empty / non-string → `422` `"Password is required"`. |
| 6 | `password` length ≥ 6 characters | Shorter → `422` `"Password must be at least 6 characters"`. |

Extra fields are ignored (forward-compatible).

### 3.2 Response — `200 OK` (success)

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "c0bf56ce-6312-4f44-a924-2a8d12cb6c4d",
      "email": "admin@example.com",
      "name": "Administrator"
    }
  },
  "message": ""
}
```

- `data.token` — JWT signed with HS256. See §4 for claims.
- `data.user.id` — UUID string (not a raw integer).
- `data.user.email` — the stored email (already lowercased on write).
- `data.user.name` — `string | null` (column is nullable).
- `data.user` **never** contains `password_hash`, `created_at`, `updated_at`,
  or `is_active` (AC-17).

**Example (live DB, seeded admin):**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "c0bf56ce-6312-4f44-a924-2a8d12cb6c4d",
      "email": "admin@example.com",
      "name": "Administrator"
    }
  },
  "message": ""
}
```

### 3.3 Response — `401 Unauthorized`

**Byte-identical response** for all three failure causes (AC-18):

| Trigger | Body |
|---|---|
| Email not found in `users` | Same as below |
| Password mismatch (bcrypt) | Same as below |
| User row exists but `is_active = false` | Same as below |

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{ "success": false, "data": null, "message": "Invalid email or password" }
```

No additional headers. No hints about which cause triggered it
(anti-enumeration — TECH_SPEC §10, PROTOTYPE §4.3).

### 3.4 Response — `422 Unprocessable Entity`

Body shape:

```json
{ "success": false, "data": null, "message": "<human-readable>" }
```

The backend emits exactly one `message` per request. Priority / order:

| Order | Condition | `message` |
|---|---|---|
| 1 | JSON parse failure, or body is not a JSON object | `"Invalid request body"` |
| 2 | `email` missing / empty / non-string | `"Email is required"` |
| 3 | `email` too long or fails format regex | `"Email is invalid"` |
| 4 | `password` missing / empty / non-string | `"Password is required"` |
| 5 | `password` shorter than 6 characters | `"Password must be at least 6 characters"` |

Every `message` is safe for the frontend to render verbatim in the
inline banner (TECH_SPEC §7).

### 3.5 Response — `429 Too Many Requests` (rate-limited)

Triggered when the IP has accumulated **≥ 5 failed attempts within a
rolling 60-second window** (TECH_SPEC §9, AC-10).

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "success": false,
  "data": null,
  "message": "Too many login attempts. Try again in 60 seconds."
}
```

- `Retry-After` is always the string `"60"` in v1.
- The 6th attempt — *regardless of whether the credentials it carries
  are correct* — is rejected with 429; the server does **not** consult
  the DB on a blocked request.
- A **successful** login clears the counter for that IP (AC-11).

### 3.6 Response — `500 Internal Server Error`

Produced only by unhandled exceptions (e.g. database outage). The
real cause is logged server-side; the client sees a generic message:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "success": false,
  "data": null,
  "message": "Something went wrong. Please try again."
}
```

---

## 4. JWT (HS256)

**Algorithm:** `HS256`.
**Signing key:** `JWT_SECRET` environment variable; falls back to
`"dev-local-secret-change-me"` for local dev **only**. Production must
set `JWT_SECRET` to a strong random value.
**TTL:** `60 minutes` (3600 s) from issuance.

**Claims**

| Claim | Type | Value |
|---|---|---|
| `sub`   | string | User UUID (stringified). |
| `email` | string | Authenticated user's email (lowercased, as stored). |
| `iat`   | number | Unix time (seconds) of issuance. |
| `exp`   | number | `iat + 3600`. |

**Header** is the default `{"alg":"HS256","typ":"JWT"}`.

**Decoding example (Python):**

```python
from jose import jwt
claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
# claims -> {"sub": "<uuid>", "email": "admin@example.com", "iat": ..., "exp": iat+3600}
```

**Verification** on future protected endpoints (not implemented in v1)
is covered by the contract in TECH_SPEC §3.7: a 401 from a protected
endpoint obligates the frontend to clear `localStorage` and redirect
to `/login`.

---

## 5. Rate-limit policy

Per TECH_SPEC §9. Implementation:

- **Scope key:** client IP (from `X-Forwarded-For` first hop if present,
  otherwise the socket peer). **Not** per account (per-account throttling
  is explicitly out of scope — PROTOTYPE §6).
- **Window:** rolling 60 seconds (implemented as a per-IP deque of
  failure timestamps).
- **Threshold:** 5 failed attempts. The 6th within the window returns 429.
- **"Failure":** any response in `{401}` counts against the IP.
  `422` validation failures **do not** count (by design — a malformed
  body isn't a credential guess).
- **Reset on success:** a 200 response clears the counter for that IP.
- **Storage:** in-process Python `dict[str, deque[float]]` protected by
  a `threading.Lock`. Single-process only — adequate for v1.
  A Redis-backed limiter is nice-to-have but not required.
- **Response on block:** 429 + `Retry-After: 60` + the §3.5 envelope.

**Test hook** (backend only): `main.rate_limiter.reset()` clears all
state. Used by the pytest suite to isolate cases; **not exposed** via
HTTP.

---

## 6. Security

- Passwords are stored **only** as bcrypt hashes in `users.password_hash`;
  the column is selected by the backend but never returned in a response
  (AC-17).
- The 401 body is **byte-identical** across unknown-email / wrong-password
  / inactive-user to prevent account enumeration (AC-18).
- CORS is pinned to `http://localhost:3000`; credentials allowed.
- `email` is lowercased and trimmed server-side before lookup.
- No password is ever logged. The structured log line (§7) carries the
  email and reason code only.
- Token is returned in the response body, not as an HTTP cookie (v1
  uses `localStorage` on the client — TECH_SPEC §8).
- Production must serve over TLS (ops-owned; not enforced by this spec).

---

## 7. Observability

On every `/api/auth/login` call the backend emits a single structured
log line via stdlib `logging` at `INFO`:

```
auth.login attempt email=<email|-> ip=<ip> success=<true|false> reason=<code>
```

**`reason` codes:**

| Code | Meaning |
|---|---|
| `ok`                     | 200 success |
| `invalid_credentials`    | 401 — unknown email OR wrong password |
| `inactive`               | 401 — `is_active = false` |
| `validation`             | 422 — body/field validation failure |
| `rate_limited`           | 429 — IP threshold exceeded |
| `server_error`           | 500 — unhandled exception (also `logger.exception`-traced) |

The log line is the audit record for PROTOTYPE §4.10. The `login_attempts`
table is **not** created in v1 (DB_SCHEMA.md §4 — logs are the sole sink).

---

## 8. Persistence contract

Read-only interactions with `users` (schema owned by DB_SCHEMA.md §2.1):

### 8.1 Login lookup

```sql
SELECT id, email, password_hash, name, is_active
  FROM users
 WHERE lower(email) = %s
 LIMIT 1;
```

Binds `lower(trim(submitted_email))`. Hits the functional unique
index `users_email_lower_idx`.

### 8.2 Columns the API never returns

`password_hash`, `created_at`, `updated_at`, `is_active` — none of
these appear in any response body.

### 8.3 Seed

`core/seed.py` creates the table (idempotent DDL mirroring
DB_SCHEMA.md §6) and upserts the default admin:

```
admin@example.com / password123    (is_active = true)
```

---

## 9. Acceptance-criterion traceability

Maps the TECH_SPEC §13 ACs that this API satisfies (UI-only ACs are
frontend-owned).

| AC | How the backend satisfies it |
|---|---|
| AC-1  | `POST /api/auth/login` returns 200 with `success=true`, a JWT string, and `data.user.email == "admin@example.com"` for the seeded admin. |
| AC-4  | Unknown email OR wrong password → 401 with the §3.3 body. |
| AC-9  | Client-bypassed invalid input → 422 with a non-empty `message`. |
| AC-10 | Sixth failed attempt in 60 s → 429 + `Retry-After: 60` + §3.5 body. |
| AC-11 | 200 success clears the IP counter (tested end-to-end). |
| AC-15 | `is_active=false` → identical 401 to AC-4. |
| AC-16 | Every response conforms to `{success, data, message}` (parametrized test). |
| AC-17 | No response contains `password_hash`. |
| AC-18 | The three 401 causes produce byte-identical JSON. |

---

## 10. Test summary

`core/tests/test_auth.py` — 16 cases, all green (`pytest tests/ -v` →
`16 passed in 8.3s`):

1. `test_login_success_envelope_and_jwt` — 200 shape + JWT claims + TTL.
2. `test_login_success_normalizes_email_case` — trim + lowercase on lookup.
3. `test_login_unknown_email_returns_identical_401`.
4. `test_login_wrong_password_returns_identical_401`.
5. `test_login_inactive_user_returns_identical_401`.
6. `test_login_422_non_json_body`.
7. `test_login_422_missing_email`.
8. `test_login_422_invalid_email`.
9. `test_login_422_short_password`.
10. `test_login_422_missing_password`.
11. `test_login_rate_limit_blocks_sixth_failed_attempt` — AC-10.
12. `test_login_successful_login_resets_rate_limit_counter` — AC-11.
13. `test_login_500_envelope_on_unexpected_error`.
14. `test_every_response_follows_envelope[case0]` — 200 envelope.
15. `test_every_response_follows_envelope[case1]` — 401 envelope.
16. `test_every_response_follows_envelope[case2]` — 422 envelope.

DB is mocked via `monkeypatch` on `main._find_user_by_email`, so the
suite needs no live Postgres.

**Smoke test against live DB** (uvicorn + curl, post-seed):

```
POST /api/auth/login  {"email":"admin@example.com","password":"password123"}
  → 200  {"success":true,"data":{"token":"...","user":{...}},"message":""}

POST /api/auth/login  {"email":"admin@example.com","password":"wrongwrong"}
  → 401  {"success":false,"data":null,"message":"Invalid email or password"}

POST /api/auth/login  {"email":"nope","password":"abc"}
  → 422  {"success":false,"data":null,"message":"Email is invalid"}
```

---

## 11. Example `curl` invocations

```bash
# Happy path
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'

# Wrong password → 401
curl -i -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"wrongwrong"}'

# Validation → 422
curl -i -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bad","password":"abc"}'

# Rate limit: 6 failures in a row from one IP → last is 429
for i in 1 2 3 4 5 6; do
  curl -i -X POST http://localhost:8000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"nobody@example.com","password":"password123"}'
done
```

---

## 12. Open questions / future work

All v1 open questions from PROTOTYPE §8 were resolved in TECH_SPEC §15.
Known follow-ups — explicitly **out of scope** for v1 — that will
affect this contract later:

- `POST /api/auth/logout` (token blocklist / refresh model).
- `GET /api/auth/me` (consumer of the JWT; required once protected
  endpoints exist).
- Redis-backed rate limiter (needed when the backend scales beyond
  one process).
- `login_attempts` table (needed when per-account throttling or an
  admin "recent attempts" view is scheduled — DDL is ready in
  DB_SCHEMA.md §4).

---

## 13. Change log

| Date (local) | Change | Author |
|---|---|---|
| 2026-04-21 | Initial contract: `POST /api/auth/login` with envelope, 200/401/422/429/500, JWT HS256 60 min, IP rate limit 5/60 s, structured log, anti-enum 401. Commit `b803184` on `develop-login-21042026-v1`. | backend-developer agent |

---

*Status: draft — awaiting user review.*
