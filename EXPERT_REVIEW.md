# Expert Review: Simple Login Page

> **Reviewer:** Expert Agent
> **Date:** 2026-04-10
> **Scope:** Full-stack login implementation (backend, frontend, database)
> **Status:** Review Complete

---

## 1. Overall Assessment

The login feature is **functional and well-structured for an MVP**. The implementation follows the PROTOTYPE.md spec accurately, uses appropriate libraries (bcrypt, JWT, Pydantic), and produces a clean user experience. However, several security and architectural issues should be addressed before any production deployment.

**Verdict:** Approved for development use. Requires hardening before staging/production.

---

## 2. Security Findings

### 2.1 Critical

| # | Issue | File | Details |
|---|-------|------|---------|
| S1 | **Hardcoded JWT secret** | `core/main.py:14` | `SECRET_KEY = "super-secret-key-change-in-production"` is checked into source control. Must be loaded from an environment variable (e.g., `os.environ["JWT_SECRET"]`). A leaked secret allows token forgery. |
| S2 | **Hardcoded database password** | `core/database.py:10` | `password="mat_khau_moi_cua_ban"` is committed in plaintext. Move to environment variable or `.env` file (excluded from VCS). |

### 2.2 High

| # | Issue | File | Details |
|---|-------|------|---------|
| S3 | **No rate limiting on login** | `core/main.py:72-126` | The `/api/auth/login` endpoint has no rate limiting. An attacker can brute-force passwords with unlimited attempts. Add a rate limiter (e.g., `slowapi`) -- recommend 5 attempts per minute per IP. |
| S4 | **No JWT validation on protected pages** | `admin/app/dashboard/page.tsx:17-18` | The dashboard checks only for the *presence* of a `token` in localStorage -- it never validates the token's signature or expiry. An expired or tampered token still grants access to the UI. |
| S5 | **localStorage token storage** | `admin/app/login/page.tsx:33-34` | Tokens in localStorage are accessible to any JavaScript running on the page, making them vulnerable to XSS. For an internal admin panel MVP this is acceptable, but production should use `httpOnly` cookies set by the backend. |

### 2.3 Medium

| # | Issue | File | Details |
|---|-------|------|---------|
| S6 | **No HTTPS enforcement** | `core/main.py` | No redirect from HTTP to HTTPS. JWT tokens sent over plain HTTP can be intercepted. In production, enforce TLS at the reverse proxy or application level. |
| S7 | **CORS allows all methods/headers** | `core/main.py:27-28` | `allow_methods=["*"]` and `allow_headers=["*"]` is overly permissive. Restrict to `["GET", "POST"]` and `["Content-Type", "Authorization"]`. |
| S8 | **No `updated_at` auto-update trigger** | `core/seed.py:16` | The `updated_at` column defaults to `NOW()` on insert but has no trigger to update on row modification. This will become stale as user records are edited. |

### 2.4 Positive Security Practices

- **Parameterized SQL queries** -- prevents SQL injection (`%s` placeholders throughout)
- **Generic auth error messages** -- "Invalid email or password" does not reveal whether the email exists, preventing enumeration
- **bcrypt password hashing** with auto-generated salt -- industry standard
- **Proper HTTP status codes** -- 401 for auth failures, 422 for validation errors
- **Pydantic `EmailStr` validation** -- rejects malformed emails at the schema level

---

## 3. Code Quality

### 3.1 Backend (`core/`)

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C1 | **No connection pooling** | Medium | `database.get_connection()` opens a new TCP connection per request. Under load this will exhaust PostgreSQL connections. Use `psycopg2.pool.ThreadedConnectionPool` or switch to `asyncpg` for async FastAPI. |
| C2 | **All routes in `main.py`** | Low | Currently acceptable with one endpoint. As more routes are added, split into `routers/auth.py`, `routers/users.py`, etc. using FastAPI's `APIRouter`. |
| C3 | **No request logging** | Medium | No logging of login attempts (success or failure). Add structured logging for audit trails -- essential for security monitoring. |
| C4 | **Synchronous DB calls in async handler** | Medium | The `login` handler is `async def` but calls synchronous `psycopg2` methods, which blocks the event loop. Either use `def` (FastAPI runs it in a threadpool) or switch to an async driver like `asyncpg`. |
| C5 | **Cursor not in context manager** | Low | If `cur.execute()` raises, `cur.close()` is skipped. Use `with conn.cursor() as cur:` pattern. |
| C6 | **`python-jose` is unmaintained** | Low | Last updated 2022, has open security advisories. Consider migrating to `PyJWT`. |

### 3.2 Frontend (`admin/`)

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C7 | **Hardcoded API URL** | Medium | `http://localhost:8000` is hardcoded in `login/page.tsx:19`. Use `process.env.NEXT_PUBLIC_API_URL` for environment-based configuration. |
| C8 | **Labels not linked to inputs** | Low | `<label>` elements lack `htmlFor` attributes and `<input>` elements lack `id` attributes. This hurts accessibility -- screen readers can't associate labels with their inputs. |
| C9 | **No TypeScript API response type** | Low | The `fetch` response is typed as `any`. Define an interface for the API response envelope to catch type errors at compile time. |
| C10 | **No `aria-live` on error message** | Low | Dynamically rendered error messages won't be announced by screen readers. Add `aria-live="polite"` to the error container. |

### 3.3 Positive Code Quality Practices

- Clean, readable component structure with proper state management
- Consistent use of the `{ success, data, message }` API envelope
- TypeScript `User` interface on the dashboard
- Proper `FormEvent` typing on submit handler
- Controlled form inputs with React state
- Clean root redirect using Next.js `redirect()` (server component)

---

## 4. Architecture Review

### 4.1 Authentication Flow

```
[Login Form] --POST--> [FastAPI /api/auth/login] --query--> [PostgreSQL users]
     |                         |
     |<-- { token, user } -----+
     |
     v
  localStorage.setItem("token", ...)
  localStorage.setItem("user", ...)
     |
     v
  redirect to /dashboard
     |
     v
  [Dashboard] -- checks localStorage -- if missing --> redirect /login
```

**Gap:** There is no backend token validation layer. Once a user has a token, no endpoint verifies it. When protected API endpoints are added, a JWT middleware/dependency is needed.

### 4.2 Missing Architectural Components

| Component | Status | Needed For |
|-----------|--------|------------|
| JWT auth middleware/dependency | Missing | Any future protected endpoint |
| Token refresh mechanism | Missing | Seamless UX after 60-min expiry |
| Logout (backend) | Missing | Token revocation / blacklisting |
| API client abstraction | Missing | Consistent error handling, auth headers |
| Environment configuration | Missing | Dev/staging/prod deployment |

---

## 5. Spec Compliance

| PROTOTYPE.md Requirement | Status | Notes |
|--------------------------|--------|-------|
| Centered login card on `#F9FAFB` | Pass | |
| 400px max-width, responsive | Pass | |
| Email + Password fields with correct styling | Pass | |
| Error message display | Pass | |
| Loading state on button | Pass | |
| Focus ring on inputs | Pass | Blue border + ring |
| POST to `/api/auth/login` | Pass | |
| 401/422 status codes | Pass | |
| Generic error message (no email enumeration) | Pass | |
| localStorage token + user storage | Pass | |
| Dashboard auth guard | Pass | Client-side only |
| Root `/` redirect to `/login` | Pass | |
| Logout clears localStorage | Pass | |

**Full spec compliance achieved: 13/13.**

---

## 6. Recommendations for Future Development

### Phase 1 -- Immediate (Before Next Feature)

1. **Move secrets to environment variables** -- JWT secret and DB password must not be in source code
2. **Add `htmlFor`/`id` to form labels/inputs** -- Quick accessibility fix
3. **Change `async def login` to `def login`** -- Avoids blocking the async event loop with synchronous psycopg2 calls

### Phase 2 -- Short-Term (Next Sprint)

4. **Implement JWT auth dependency** -- Create a `get_current_user()` FastAPI dependency that validates the JWT from the `Authorization: Bearer` header
5. **Add connection pooling** -- Replace `get_connection()` with a connection pool initialized at app startup
6. **Add rate limiting** -- Use `slowapi` to limit login attempts (e.g., 5/min per IP)
7. **Add request logging** -- Log login attempts with timestamp, email (not password), IP, and success/failure
8. **Create shared API client** -- Frontend utility that wraps `fetch()` with base URL, auth headers, and error handling

### Phase 3 -- Medium-Term (Production Readiness)

9. **Switch to httpOnly cookies** -- Backend sets `Set-Cookie` with `httpOnly`, `Secure`, `SameSite=Strict` flags
10. **Add token refresh** -- Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
11. **Add backend logout** -- Token blacklist (Redis) or short-lived tokens with refresh rotation
12. **Add password reset flow** -- Email-based reset with time-limited tokens
13. **Add user management CRUD** -- Admin endpoints for creating, updating, and deactivating users
14. **Add E2E test coverage** -- Playwright tests for all 7 test scenarios in PROTOTYPE.md
15. **Add backend tests** -- pytest tests for the login endpoint with various inputs

### Phase 4 -- Production Hardening

16. **Two-Factor Authentication (2FA)** -- TOTP-based 2FA for admin accounts
17. **Role-Based Access Control (RBAC)** -- Roles and permissions for fine-grained authorization
18. **Security headers** -- `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`
19. **Database migrations** -- Adopt Alembic for schema versioning instead of seed scripts
20. **Session management UI** -- View and revoke active sessions

---

## 7. Summary

| Category | Score | Notes |
|----------|-------|-------|
| Functionality | 9/10 | Fully working login flow, meets all spec requirements |
| Security | 5/10 | Hardcoded secrets, no rate limiting, no token validation -- typical for early MVP but must be addressed |
| Code Quality | 7/10 | Clean and readable; minor issues with async/sync mismatch, accessibility, and hardcoded config |
| Architecture | 6/10 | Solid foundation but missing middleware, pooling, and configuration layers needed for growth |
| Spec Compliance | 10/10 | All PROTOTYPE.md requirements met |

**Bottom line:** The implementation is a solid MVP that correctly delivers the login feature. The primary risks are the hardcoded secrets (S1, S2) and the lack of server-side token validation (S4). Address these before expanding the feature set.
