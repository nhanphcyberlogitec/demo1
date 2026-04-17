# EXPERT_REVIEW.md — Admin Panel Login Feature

**Version:** 1.0
**Date:** 2026-04-14
**Reviewer:** Reviewer Agent
**Branch:** `develop-test-3` (HEAD: `f1e674b`)
**Scope reviewed:** `core/` (FastAPI backend), `admin/` (Next.js frontend), DB schema, specs, QA history (issues #26–#29).
**Inputs:** `PROTOTYPE.md` v1.0, `TECH_SPEC.md` v1.0, `DB_SCHEMA.md` v1.0, `BACKEND_API.md` v1.0, `BUG_REPORT.md` (Round 3 — PASS).
**Verdict:** **Ship-with-gates.** The feature meets every acceptance criterion in TECH_SPEC §10.1/10.2 and QA reports zero open issues. However, several defects — two of them severity **High** — are real and must be addressed before any deployment beyond local dev.

---

## 1. Executive summary

| # | Finding                                                                                  | Severity  | Area               | Location                        |
|---|------------------------------------------------------------------------------------------|-----------|--------------------|---------------------------------|
| 1 | JWT signing secret hard-coded with default value                                         | **High**  | Security           | `core/main.py:14`               |
| 2 | Timing side-channel leaks email existence despite generic `401`                          | **High**  | Security           | `core/main.py:90–99`            |
| 3 | Playwright E2E suite is stale and will fail — asserts obsolete UI (`h1` "Login", "Welcome, Admin!", `user.name`, wrong placeholders) | **High** | Tests / CI | `admin/e2e/login.spec.ts:14–131`|
| 4 | Backend `pytest` suite required by TECH_SPEC §10.3 is **absent**                         | **High**  | Tests              | `core/tests/` (missing)         |
| 5 | Frontend Jest suite required by TECH_SPEC §10.3 is **absent**                            | Medium    | Tests              | `admin/` (no `*.test.*`)        |
| 6 | Blocking I/O (`psycopg2`, `bcrypt.checkpw`) run directly inside async handler            | Medium    | Performance        | `core/main.py:74–99`            |
| 7 | JWT stored in `localStorage` — readable by any XSS                                       | Medium    | Security           | `admin/app/login/page.tsx:117–118` |
| 8 | Auth guard is client-side only (`useEffect` in every protected page)                     | Medium    | Architecture       | `admin/app/dashboard/page.tsx:13–28`, `admin/app/login/page.tsx:40–46` |
| 9 | `API_URL` hard-coded to `http://localhost:8000`                                          | Medium    | Architecture       | `admin/app/login/page.tsx:7`    |
|10 | CORS `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True`              | Low       | Security           | `core/main.py:23–29`            |
|11 | No schema migrations — DDL lives in `seed.py`                                            | Low       | Ops                | `core/seed.py:11–36`            |
|12 | Stale banner lingers on re-submit with empty fields (noted by QA §4)                     | Low       | UX                 | `admin/app/login/page.tsx:82–141` |
|13 | `requestAnimationFrame`-scheduled focus is fragile                                       | Low       | Code quality       | `admin/app/login/page.tsx:56–64` |
|14 | `psycopg2` pool created at import time with no retry / error handling                    | Low       | Robustness         | `core/database.py:11–19`        |

The "High" items are all real, narrow, and fixable in hours — none are architectural.

---

## 2. Security

### 2.1 Hard-coded JWT secret — **High** (`core/main.py:14`)

```python
SECRET_KEY = "super-secret-key-change-in-production"
```

The secret is only a literal. There is no `os.getenv` fallback, no environment-variable override, and no fail-fast when running with the default. `BACKEND_API.md` §3 / §7 *documents* that production must override, but the code does not enforce it. In practice, deploying from this branch will ship the default secret. A committed, public default secret means anyone can forge a valid JWT for any `sub`/`email`.

**Recommended fix:** load from `os.environ["JWT_SECRET_KEY"]`, raise at startup if unset, and remove the literal default. Pair with `pydantic-settings` (Finding 9 helps here too).

### 2.2 Email-enumeration timing channel — **High** (`core/main.py:90–99`)

```python
if row is None:
    return _invalid_credentials_response()         # ← returns ~instantly
...
if not bcrypt.checkpw(payload.password.encode(...), password_hash.encode(...)):
    return _invalid_credentials_response()         # ← ~200ms of bcrypt work
```

TECH_SPEC §6.3 requires that the *message* not disclose which half of the credential pair is wrong, and BACKEND_API §4.1 reiterates the identical envelope requirement. The code satisfies both. But the **response time** differs by roughly an order of magnitude between "email not in DB" (fast path) and "email exists / password wrong" (bcrypt path). An attacker can enumerate valid admin emails with a handful of requests.

**Recommended fix:** on the unknown-email path, run a throwaway `bcrypt.checkpw` against a fixed dummy hash so both branches pay the same cost. Example:

```python
_DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()
...
if row is None:
    bcrypt.checkpw(payload.password.encode(), _DUMMY_HASH.encode())
    return _invalid_credentials_response()
```

Same treatment for the `is_active = False` branch.

### 2.3 JWT in `localStorage` — Medium (`admin/app/login/page.tsx:117–118`)

The token is written to `localStorage`, which is readable by any script that runs in the document. One XSS (dependency compromise, a future content-injection bug) exfiltrates every admin's session. The spec explicitly chose `localStorage` (TECH_SPEC §4.2), so this is a deliberate trade-off — but it should be reconsidered before this becomes the pattern for every future admin feature. An `HttpOnly`, `Secure`, `SameSite=Lax` cookie issued by the backend is the standard alternative and interacts well with Next.js App Router middleware (Finding 8).

### 2.4 CORS is wide open for allowed origin — Low (`core/main.py:23–29`)

`allow_methods=["*"]` and `allow_headers=["*"]` combined with `allow_credentials=True` is permissive; since only a single origin is whitelisted this is acceptable for local dev, but the production config should enumerate methods/headers explicitly.

### 2.5 Password policy — Low

TECH_SPEC §6 mandates a 6-character minimum. That is below NIST SP 800-63B guidance (8 chars minimum, ideally much longer). Out of spec scope, but worth raising for the next iteration.

### 2.6 No rate limiting / lockout — Low (documented as deferred)

`BACKEND_API.md` §4.1 lists this as out of scope. Reiterated here only because it compounds §2.2: enumeration + unlimited bcrypt attempts = offline-speed online attack against any discovered email.

---

## 3. Code quality & correctness

### 3.1 Stale Playwright suite — **High** (`admin/e2e/login.spec.ts`)

The E2E file at `admin/e2e/login.spec.ts` was not updated after the Figma redesign / TECH_SPEC v1.0 implementation. Concrete mismatches against the shipped UI:

| Line(s) | E2E assertion                              | Actual UI                                         |
|---------|--------------------------------------------|---------------------------------------------------|
| 14      | `h1` text `"Login"`                        | `"Admin Panel"` (`login/page.tsx:149`)            |
| 20–22   | Submit button text `"Login"`               | `"Sign In"` (`login/page.tsx:262`)                |
| 26–32   | Email placeholder `"admin@example.com"`    | `"you@example.com"` (`login/page.tsx:179`)        |
| 26–32   | Password placeholder `"Enter password"`    | `""` — empty per TECH_SPEC §2.2 / issue #28       |
| 46–47   | `h1` `"Dashboard"` + `"Welcome, Admin!"`   | `h2 "Dashboard"`, `"Welcome, <email>."`           |
| 129–131 | `user.name === "Admin"`                    | Envelope returns `{ id, email }` only (BACKEND_API §4.1)|
| 107–111 | "HTML5 required validation" keeps on page  | Form is `noValidate`; validation is inline React  |

QA Round 3 passed manually, so these failing automated tests did not block ship — but they will red-light CI the first time Playwright is wired into a pipeline, and they currently offer zero regression protection. They must either be rewritten to match TECH_SPEC v1.0 or deleted.

### 3.2 Missing backend `pytest` suite — **High** (`core/tests/` absent)

TECH_SPEC §10.3 requires pytest coverage of: happy path, unknown email, wrong password, malformed email, short password, inactive user, envelope shape. Nothing exists under `core/tests/`. The QA agent tested these manually; there is no durable artefact. This is the highest-leverage gap to fix — all seven cases are trivial once a FastAPI `TestClient` fixture is in place.

### 3.3 Missing frontend Jest suite — Medium (`admin/` has no `*.test.*`)

TECH_SPEC §10.3 requires Jest coverage for each client-side validation rule, the loading state, the post-login redirect, and the already-authenticated redirect. `jest.config.js` and `jest.setup.ts` exist; no test files do.

### 3.4 Focus restoration using `requestAnimationFrame` — Low (`admin/app/login/page.tsx:56–64`)

The `shouldFocusPassword` ref + `requestAnimationFrame` dance (and the explanatory comment) is the fix for issue #29, and it does work. But it relies on a subtle ordering between React's disabled-state re-render and the browser's focus resolution. A more robust pattern is to keep the password input enabled during the in-flight request (disable the *button* only, or use `readOnly` on the input), which removes the "re-enable then focus" race.

### 3.5 Stale error banner on empty-field re-submit — Low (QA §4)

QA noted this as "future UX polish." One-line fix: the banner's DOM currently stays in the tree on re-submit because the empty-field branch short-circuits before the next `setFormError`. Clearing `formError` unconditionally at entry to `handleSubmit` is already done (`page.tsx:84`), but the banner re-appears if a prior 401 happened and state hasn't settled. Easy win.

### 3.6 Duplicated, stringly-typed fetch logic — Low

`admin/app/login/page.tsx:99–141` hand-parses the envelope and branches on `response.status`. An `api.ts` client with a typed `LoginResponse` union pays for itself on the second caller.

---

## 4. Architecture

### 4.1 All routes in `main.py` — acceptable **now**, plan the split

One endpoint, 115 lines — no split needed yet. CLAUDE.md already calls out "as it grows, split into one router per domain." Make `core/routers/auth.py` + `core/deps.py` the template when the second endpoint lands.

### 4.2 Client-side-only auth guard — Medium

Both `/login` (`page.tsx:40–46`) and `/dashboard` (`page.tsx:13–28`) perform the token check in a `useEffect`. Consequences:

- Protected pages render a blank placeholder until JS has hydrated and the effect has run.
- No server-side verification; a user with JS disabled or a bot sees the protected page's source.
- Each new protected page re-implements the pattern.

The App Router's `middleware.ts` is the natural home for this: read the token from a cookie (ties into §2.3), redirect anonymous users at the edge. This should be the first refactor of the second protected feature.

### 4.3 Hard-coded backend URL — Medium (`admin/app/login/page.tsx:7`)

`const API_URL = "http://localhost:8000/api/auth/login"`. The spec calls out that production origins are configured per environment (TECH_SPEC §7). Use `process.env.NEXT_PUBLIC_API_BASE_URL` now while there is exactly one call site.

### 4.4 No shared DTO / envelope type — Low

The envelope type `{ success; data; message }` is re-declared inline at `login/page.tsx:105–109`. Hoist into `admin/types/api.ts` before adding the second endpoint.

### 4.5 Synchronous DB driver under async FastAPI — Medium (`core/database.py`, `core/main.py:74`)

FastAPI's route handler is `async def`, but `psycopg2` is a blocking driver and `bcrypt.checkpw` takes ~100–300 ms of CPU. Under load this parks the event loop. Two acceptable fixes: (a) switch to `psycopg` v3 (`psycopg_pool`) in async mode or `asyncpg`; (b) at minimum, wrap the blocking work with `fastapi.concurrency.run_in_threadpool(...)`. For a single-endpoint panel this is premature, but worth flagging before the next feature adds concurrent load.

### 4.6 No migrations — Low (`core/seed.py:11–36`)

Schema + seed are conflated into one script; `CREATE TABLE IF NOT EXISTS` is idempotent but cannot express the second schema change. Introduce Alembic before the second `ALTER TABLE`.

### 4.7 `psycopg2` pool created at import time — Low (`core/database.py:11–19`)

If the database is unreachable at process start, `uvicorn` crashes with an opaque traceback. A FastAPI `lifespan` handler that constructs the pool on startup (and closes it on shutdown) gives a clearer failure mode and enables graceful restarts.

---

## 5. Performance

- Login path cost is dominated by bcrypt (~12 rounds default). The pool (`min=2, max=10`) is appropriate for expected admin load.
- No caching concerns — `Cache-Control: no-store` is correctly applied to 200/401/422 (issue #26).
- Frontend bundle is minimal — login page + dashboard + global layout. No perf concerns.
- The client's `checkingAuth` gate avoids a render-flash on `/login` for already-authed users (TECH_SPEC Flow E); it renders a neutral empty div, which is cheap.

---

## 6. Spec conformance

Every `AC-N` in TECH_SPEC §10.1/10.2 has a matching code path:

| AC    | Location                                                             | Status |
|-------|----------------------------------------------------------------------|--------|
| AC-1  | `admin/app/login/page.tsx:146–267`, `layout.tsx:15–18`               | PASS   |
| AC-2  | `login/page.tsx:12–14, 86`                                           | PASS   |
| AC-3  | `login/page.tsx:17–19, 87`                                           | PASS   |
| AC-4  | `login/page.tsx:13`                                                  | PASS   |
| AC-5  | `login/page.tsx:19`                                                  | PASS   |
| AC-6  | `login/page.tsx:116–120`                                             | PASS   |
| AC-7  | `core/main.py:66–71, 91, 96, 99`                                     | PASS   |
| AC-8  | `login/page.tsx:191, 232, 252–263`                                   | PASS   |
| AC-9  | `login/page.tsx:56–64, 132–137` (fix for issues #27, #29)            | PASS   |
| AC-10 | `login/page.tsx:40–46`                                               | PASS   |
| AC-11 | `admin/app/page.tsx:1–5`                                             | PASS   |
| AC-12 | Measured during QA                                                   | PASS   |
| AC-13 | Native tab order + Enter-submit on `<form>`                          | PASS   |
| AC-14 | `login/page.tsx:218` (`type="password"`)                             | PASS   |
| AC-15 | Backend never logs payload; DB stores bcrypt only                    | PASS   |
| AC-16 | `core/main.py:32–33` + used by every response                        | PASS   |

**Gaps against §10.3 (test coverage):** backend pytest and frontend Jest suites are absent (findings §3.2, §3.3). The E2E suite that exists is stale (§3.1).

**PROTOTYPE.md alignment:** BR-1 through BR-9 are all satisfied. Open questions §8 (1–4) were resolved by TECH_SPEC §9 default assumptions and are reflected in the build.

---

## 7. QA history insights (issues #26–#29)

- **#26 (Cache-Control on 422)** — fix at `core/main.py:46` (headers in the exception handler) is correct and general. No regression risk.
- **#27 → #29 (password focus after failure)** — two rounds of fixes, landing on the `requestAnimationFrame` pattern. The fix works but is subtle (§3.4). All three focus-after-async bugs traced to React re-render ordering vs. browser focus timing. Durable lesson: *avoid disabling the element you need to focus; disable only the submit button.*
- **#28 (password placeholder)** — trivial; no lesson.

Pattern overall: UX polish around asynchronous state transitions is where bugs clustered. Automated coverage of those transitions (§3.1–§3.3) would have caught #27 and #29 without a QA round.

---

## 8. Future directions (prioritised)

1. **Fix the two High-severity security items** (§2.1, §2.2). Hours of work.
2. **Restore test coverage to match TECH_SPEC §10.3** — rewrite `admin/e2e/login.spec.ts` against v1.0 UI, add `core/tests/test_auth.py` with the seven documented cases, add Jest tests for the four documented frontend cases. Wire into CI so regressions are caught before QA.
3. **Promote the JWT from `localStorage` to an HttpOnly cookie**, and move the auth guard into a Next.js `middleware.ts`. Do this before the second protected page is built — retrofitting later is painful.
4. **Introduce `pydantic-settings` / env-driven config**: `JWT_SECRET_KEY`, `JWT_EXPIRE_MINUTES`, `NEXT_PUBLIC_API_BASE_URL`, `CORS_ORIGINS`. Fail-fast on missing secret. Remove the literal in `core/main.py:14`.
5. **Adopt Alembic** before the next schema change.
6. **Split `core/main.py`** into `routers/auth.py` + `deps.py` when the second endpoint lands.
7. **Build a typed frontend API client** (`admin/lib/api.ts`) and the shared envelope type in `admin/types/api.ts` before the second `fetch` call site exists.
8. **Async DB + thread-pooled bcrypt** when the panel adds a second concurrent endpoint.
9. **Deferred auth endpoints** (`/logout`, `/me`, `/refresh`, `/forgot-password`) land when prioritised; the JWT-revocation story should be decided alongside `/logout`.
10. **Rate limiting / account-lockout** — `slowapi` on the login route; pair with a structured audit log (`login_attempts` table).

---

## 9. Final note

The feature as shipped is internally consistent, functionally complete against the spec, and well-structured for a first increment. The security findings (§2.1, §2.2) and the test-coverage gap (§3.1–§3.3) are the only items that must be addressed before this code is deployed anywhere beyond local dev; everything else is healthy forward-looking work.
