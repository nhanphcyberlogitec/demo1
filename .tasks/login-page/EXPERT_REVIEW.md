# Expert Review — Login Page

**Task:** `.tasks/login-page`
**Branch:** `develop-blank-project`
**Reviewer:** reviewer (agent)
**Date:** 2026-04-21
**Scope:** Full post-implementation review after Round 2 QA passed 28/28 (14 pytest + 14 Playwright) with zero open GitHub issues. One issue (#37, frontend autofocus, severity:medium) was filed and closed by commit `94dc98c`.

Every finding below is grounded in a concrete `file:line` (or commit SHA). Architectural observations reference CLAUDE.md conventions. Generic advice has been avoided.

---

## 1. Verdict

**Ship-ready for the localhost dev phase it was scoped for.** The login flow satisfies PROTOTYPE §5 acceptance criteria and TECH_SPEC §§1–10 with only minor deviations (observability gap, one security side-channel in the 401 path). The monorepo conventions in CLAUDE.md are followed cleanly. Before this code leaves the dev host, four items in §4.2 and §4.5 must be addressed — in particular `JWT_SECRET` hardening, rate limiting, the bcrypt timing side-channel, and the localStorage-backed access token.

---

## 2. Code Quality

### 2.1 Strengths
- **Clear, documented state machine on the client.** `admin/app/login/page.tsx:19-28` models the form as a tagged union (`idle | pending | error-credentials | error-network`) and renders a single `banner` derived from it (`login/page.tsx:209-214`). No ad-hoc boolean soup.
- **Validator messages are the user-facing copy.** `core/main.py:94-121` raises `ValueError` with the exact strings in TECH_SPEC §5 and BACKEND_API §3.3, so the 422 handler can forward them verbatim without string mapping tables. This is a much cleaner path than translating codes in the exception handler.
- **Backend envelope is centralized.** `_ok` / `_err` helpers in `core/main.py:61-69` guarantee every response follows `{ success, data, message }`, matching CLAUDE.md "API Response Format".
- **JWT helper is single-purpose and testable.** `core/main.py:227-230` encapsulates `sub`/`email`/`exp`; no claim-building logic leaks into the handler.
- **Autofocus fix is defensive and commented.** `admin/app/login/page.tsx:87-91` runs `emailRef.current?.focus()` in its own effect gated on `checkingSession === false`, with an explanatory comment referencing the class of bug it avoids.

### 2.2 Issues to address (ordered by impact)

| # | Finding | Location | Impact | Suggested follow-up |
|---|---------|----------|--------|---------------------|
| Q-1 | **Global `Exception` handler swallows errors silently.** `core/main.py:177-187` returns a 500 envelope but never logs. A handler bug (e.g. bad bcrypt hash in DB, pool exhaustion) will produce an opaque 500 with no server-side trace. | `core/main.py:177-187` | Observability gap. TECH_SPEC §8.5 authorizes INFO-level log events. | Wire `logger.exception(...)` before returning, keyed to a correlation id. Do **not** include `password` (still fine — `exc` doesn't carry it). |
| Q-2 | **`_strip_value_error_prefix` is brittle.** Relies on the literal Pydantic v2 string prefix `"Value error, "`. Any Pydantic major-version bump can silently change this, at which point every 422 message becomes `Value error, Email is required` in the client UI. | `core/main.py:129-132` | Medium (coupling to Pydantic internals). | Prefer raising `PydanticCustomError` with a stable `type` and matching on `err_type` instead of message. |
| Q-3 | **Dead parameter.** `_fallback_message_for(field, err_type)` never reads `err_type`. | `core/main.py:135-141` | Low. | Drop the arg or use it to distinguish "missing" vs "type_error". |
| Q-4 | **Auth-storage read duplicated between `login` and `dashboard`.** The same `try/catch` around `localStorage.getItem("token")` / `getItem("user")` appears at `admin/app/login/page.tsx:61-81` and `admin/app/dashboard/page.tsx:16-60`, with slightly different error paths. When the next protected page lands it will be copied a third time. | `admin/app/login/page.tsx:61-81`, `admin/app/dashboard/page.tsx:16-60` | Medium duplication; drift risk. | Extract a `useSession()` hook (`getSession`, `clearSession`, `requireSession`) into `admin/app/_lib/session.ts`. |
| Q-5 | **Hardcoded API URL in the page component.** `const API_URL = "http://localhost:8000/api/auth/login"` at `admin/app/login/page.tsx:11`. CLAUDE.md already flags "No shared types or API client — frontend uses raw fetch()". | `admin/app/login/page.tsx:11` | Low in this phase; blocker for staging/prod. | Introduce `admin/app/_lib/api.ts` with `process.env.NEXT_PUBLIC_API_BASE_URL` and a single `postJson()` that returns `{ success, data, message }`. |
| Q-6 | **Validator messages: client ends with "." but backend doesn't.** `admin/app/login/page.tsx:32-34` emits `"Email is required."`; backend emits `"Email is required"` (`core/main.py:101`). The E2E suite already had to paper over this — `admin/e2e/login.spec.ts:190-195` uses `toContainText` instead of `toHaveText`. Future localization will be harder with two source-of-truth copies. | `admin/app/login/page.tsx:30-44` vs `core/main.py:92-121` | Low. | Pick one (drop the trailing period server-side **and** client-side). |
| Q-7 | **No response-shape guard on the client.** `admin/app/login/page.tsx:160-177` trusts that `body.data.user` is a valid `{ id, email }`. If backend ever returns `data: {}`, the page stores `"undefined"` in localStorage and the dashboard renders `Welcome, undefined`. | `admin/app/login/page.tsx:149-177` | Low today (backend is locked down), latent. | Validate with zod (or a tiny hand-rolled `isUser()` guard) before calling `localStorage.setItem`. |

---

## 3. Architecture

### 3.1 Alignment with CLAUDE.md
- **Backend**: CLAUDE.md says "Currently all routes in `core/main.py`; as it grows, split into one router per domain." `core/main.py` is 273 lines with config, Pydantic, handlers, DB access, JWT, and the route itself in a single file. Acceptable for one endpoint; the *next* endpoint should land in `core/routers/auth.py` (and `get_user_by_email` into `core/db/users.py`) before this file grows further. (Don't refactor speculatively — just don't add a second route to `main.py`.)
- **Frontend**: CLAUDE.md says "pages in `admin/app/`, all page components are client components". Matches. Root `/` is correctly a server-component `redirect()` (`admin/app/page.tsx:1-5`).
- **DB pool lifecycle**: `core/database.py:29-36` — min=2/max=10, lazy init, matches CLAUDE.md description exactly.

### 3.2 Module boundaries
- `core/main.py:195-219` (`get_user_by_email`) mixes transport shape (dict) with persistence. It's deliberately defined at module scope so tests can monkeypatch (`core/tests/test_auth.py:41, 60, 158`), and that works — but the same module-level patching becomes a code smell once two or three endpoints share it. Moving it to `core/db/users.py` and injecting via FastAPI `Depends()` would fix both concerns without breaking the tests (override the dependency instead).
- **No dependency injection for the DB in routes.** `login()` reaches directly into `database.get_connection()` via `get_user_by_email`. FastAPI's `Depends` would let tests stub without monkeypatching and would let you swap pools in fixtures. Deferring is fine; note it for the next endpoint.

### 3.3 Test architecture gap
- All 14 backend tests are unit tests with `get_user_by_email` monkeypatched (`core/tests/test_auth.py:39-61`). There is **zero** test that exercises the real connection pool + real DDL + real bcrypt hash together. AC-3 is asserted at E2E only (`admin/e2e/login.spec.ts:77-89`) — meaning a regression that broke the SQL query (e.g. column rename in `core/main.py:207`) would not fail pytest, only Playwright. Add one integration test that stands up a transactional fixture against Postgres (pytest-postgresql, or a `psycopg2` transaction rolled back per test) to cover the pool path end-to-end.

### 3.4 Frontend architecture
- **Guard-flash prevention is correct.** `admin/app/dashboard/page.tsx:72-75` returns a blank `aria-busy` main until auth resolves, matching TECH_SPEC §3.6 "no protected content flash". E2E-09 (`admin/e2e/login.spec.ts:201-208`) asserts this.
- **No Suspense / Server Components used for auth state.** Acceptable for the phase; if the app grows to >3 protected pages, consider migrating the guard to a server component that reads a cookie, eliminating the white flash entirely.

---

## 4. Security

### 4.1 What's right
- **401 bodies are byte-identical** for unknown-email and wrong-password (`core/main.py:246-259`, asserted by `test_401_bodies_are_identical_for_unknown_and_wrong` in `core/tests/test_auth.py:146-173`).
- **Password never in logs / response / localStorage.** Confirmed by `test_login_success_never_leaks_password_hash` (`core/tests/test_auth.py:94-103`) and E2E-14 (`admin/e2e/login.spec.ts:297-336`).
- **Bcrypt used correctly.** `core/main.py:250-256` catches malformed-hash `ValueError`/`TypeError` and treats them as auth failure — no oracle on DB corruption.
- **Password-hash not selected into the DTO.** `core/main.py:263-272` explicitly whitelists `{ id, email }`.
- **CORS is tight.** `allow_origins=["http://localhost:3000"]` (`core/main.py:49`). Note `allow_credentials=True` combined with a single origin is safe; it becomes dangerous only if anyone later changes `allow_origins` to a wildcard.

### 4.2 Findings (severity ordered)

| # | Finding | Location | Severity | Fix direction |
|---|---------|----------|----------|---------------|
| **S-1** | **Bcrypt timing side-channel defeats the byte-identical 401.** `core/main.py:246` returns 401 the moment `user is None` — **before** bcrypt runs. On the wrong-password path, `bcrypt.checkpw` (`:250-253`) takes ~100–200ms at the default cost factor of 12; on unknown-email the response is <1ms. An attacker measuring wall-clock time of the 401 can therefore distinguish "email exists" vs "email doesn't exist", re-enabling the exact user enumeration defense §5.4 was designed to prevent. The envelope-identical test (`core/tests/test_auth.py:146-173`) does not catch this because it only compares status + body. | `core/main.py:246-259` | **High** | Always run bcrypt with a dummy hash on the `user is None` path, e.g. compute a module-level `_DUMMY_HASH = bcrypt.hashpw(b"x", bcrypt.gensalt())` and do `bcrypt.checkpw(req.password.encode(), _DUMMY_HASH)` before returning the generic 401. Asserts would need a jitter tolerance (±30ms). |
| **S-2** | **`JWT_SECRET` has a silent production footgun.** `core/main.py:34` falls back to `"dev-insecure-change-me"` when the env var is unset. A prod deploy that simply forgets `JWT_SECRET` will sign real admin JWTs with a **known public string** and the app will start cleanly. | `core/main.py:34` | **High** (in prod) / **Low** (dev). | Refuse to start (or refuse to sign) when `JWT_SECRET` equals the placeholder AND `ENV=production` (or any non-dev marker). Minimum: at import time, `if os.getenv("ENV") == "production" and JWT_SECRET == "dev-insecure-change-me": raise RuntimeError(...)`. |
| **S-3** | **No rate limiting.** BACKEND_API.md §1 acknowledges this ("Not implemented this phase"). Online credential stuffing against `/api/auth/login` is wide open — 10 workers × default bcrypt cost 12 ≈ ~60 guesses/sec, and the DB pool saturates before the CPU does. | `core/main.py:238-272` (endpoint has no throttle) | **High** (for any non-dev deploy). | SlowAPI (`pip install slowapi`) with per-IP and per-email buckets; integrate with a 429 branch in the envelope. Also add account-lockout counter on `users` or a `login_attempts` table. |
| **S-4** | **Access token stored in `localStorage` → XSS-exfiltratable.** `admin/app/login/page.tsx:167` writes the JWT to `localStorage`, and `admin/app/dashboard/page.tsx:20` reads it. Any XSS vector (future CKEditor field, markdown renderer, unvetted third-party script) steals every admin session. | `admin/app/login/page.tsx:166-168`, `admin/app/dashboard/page.tsx:17-25` | **Medium** (no XSS vectors exist today) / **High** latent. | Migrate to an `HttpOnly; Secure; SameSite=Strict` cookie issued by the backend, and have the dashboard guard call `GET /api/me` on mount instead of reading `localStorage`. Requires CSRF handling; see §6. |
| S-5 | **Bcrypt cost is the library default (≈12).** `core/seed.py:34` uses `bcrypt.gensalt()` with no explicit rounds. Fine baseline, but for admin-tier accounts OWASP currently recommends 12–14 depending on hardware. | `core/seed.py:34` | Low. | Pass `bcrypt.gensalt(rounds=13)` and re-run seed. |
| S-6 | **CORS `allow_credentials=True` + `allow_methods=["*"]` + `allow_headers=["*"]`** (`core/main.py:47-53`). In dev this is fine because `allow_origins` is a single literal. In prod, the combination is risky if someone later relaxes origins. | `core/main.py:47-53` | Low now, fragile. | Tighten to `allow_methods=["POST", "OPTIONS"]` and explicit headers once other routes land. |
| S-7 | **No request-body logging confirmed** — positive finding. Grepped `core/` for `logger`/`logging`/`print` inside the login path: nothing. Matches TECH_SPEC §8.1. When S-1 or S-2 trigger logging, the new logger MUST NOT log request bodies. | `core/main.py` | OK | Document a linter rule (e.g. `pylint` plugin forbidding `logger.info(req.*)` in the auth router) when the next endpoint lands. |
| S-8 | **JWT has no `jti`, no `iat`, no `aud`, no `iss`.** `core/main.py:229` sets only `sub`/`email`/`exp`. This makes server-side revocation (logout-everywhere, compromised-token blacklist) impossible. | `core/main.py:227-230` | Low today (no logout-everywhere feature); blocker for MFA / session-kill. | Add `jti` (UUID4) + persist-on-revoke table; add `iat` for post-issue-time checks. |

---

## 5. Performance

| # | Finding | Location | Notes |
|---|---------|----------|-------|
| P-1 | **Pool sized at max=10; bcrypt verify is ~100–200ms at default cost.** `core/database.py:29-36`. Under a sustained 20 req/s of login attempts, the pool won't be the bottleneck — the GIL + bcrypt CPU will be (bcrypt releases the GIL, so in practice ~10–15 concurrent logins × 100ms = 1.0–1.5s wall time to clear a backlog of 10). For a single admin panel that's fine; under any real attack it collapses. | `core/database.py:29`, `core/main.py:250-253` | Pair with S-3 (rate limiting); on an attack the limit should stop traffic before the pool is hit. |
| P-2 | **Frontend bundle is light.** `admin/app/login/page.tsx` imports only `react` and `next/navigation`; SVGs are inline; no icon library. `admin/app/globals.css` is Tailwind + Inter only. Nothing to flag. | `admin/app/login/page.tsx`, `admin/app/layout.tsx:1-9` | OK. |
| P-3 | **Playwright `slowMo: 2000` in the committed config** (`admin/playwright.config.ts:14-16`) — intentional for review visibility, but E2E-12 had to time its mock delay at 8000 ms (`admin/e2e/login.spec.ts:253-256`) to outlast slowMo. CI runtime is currently 2.6 min for 14 specs. Consider guarding `slowMo` behind an env var (`HEADED=1`) so CI can run unthrottled. | `admin/playwright.config.ts:14-16` | Follow-up. |

---

## 6. Spec Conformance — TECH_SPEC §§1–10

| Spec § | What the spec requires | Implementation | Status |
|--------|------------------------|----------------|--------|
| §1 | Single-form web login, existing `users`, JWT + bcrypt, envelope, CORS localhost:3000 | `core/main.py`, `admin/app/login/page.tsx`, `core/database.py` | **Pass** |
| §2.1 (`/`) | Server-side redirect to `/login` | `admin/app/page.tsx:1-5` — `redirect("/login")` in a non-`"use client"` page | **Pass** |
| §2.2 (`/login`) | Client component, fields + attributes, `autofocus` on mount, state list, already-signed-in bounce | `admin/app/login/page.tsx:1, 46-91, 203-207, 283-344`. `autofocus` fixed by commit `94dc98c` (see §7). | **Pass** |
| §2.3 (`/dashboard`) | Client component, guard, logout clears + redirects | `admin/app/dashboard/page.tsx:16-70` | **Pass** |
| §3.1 Happy path | Valid login stores token+user, redirects to `/dashboard` | `admin/app/login/page.tsx:165-177` | **Pass** |
| §3.2 Invalid creds | 401 → generic banner, password cleared, focus email | `admin/app/login/page.tsx:179-186` | **Pass** |
| §3.3 Client validation | Blocks submit, per-field messages, focus first invalid | `admin/app/login/page.tsx:104-128` | **Pass** |
| §3.4 Server 422 | Per-field rendering | `admin/app/login/page.tsx:188-196` + E2E-08 | **Pass** |
| §3.5 Signed-in /login | Redirect to dashboard | `admin/app/login/page.tsx:61-81` | **Pass** |
| §3.6 Unauthed /dashboard | Redirect, no flash | `admin/app/dashboard/page.tsx:27-42, 72-75` | **Pass** |
| §3.7 Logout | Clears, redirects | `admin/app/dashboard/page.tsx:62-70` | **Pass** |
| §3.8 Backend unreachable | Generic banner, no stack | `admin/app/login/page.tsx:142-147, 198-201` | **Pass** |
| §4.1 / §4.2 Endpoint + body | `POST /api/auth/login`, JSON | `core/main.py:238` | **Pass** |
| §4.3 Envelope shapes | 200 / 401 / 422 / 500 bodies | `core/main.py:61-69, 144-187, 246-272` | **Pass** |
| §4.4 Backend flow | Parse → normalize → lookup → bcrypt → JWT | `core/main.py:92-106, 238-272` | **Pass** |
| §5.1 / §5.2 Validation rules | Email trim+lower, length+regex, password 8-128 | `core/main.py:92-121`, client `admin/app/login/page.tsx:30-44` | **Pass** |
| §5.3 Client + server enforcement | Both layers enforce | `admin/app/login/page.tsx:109-128` + `core/main.py:92-121` | **Pass** |
| §5.4 Bad-creds generic, 422 field-scoped | Single 401 message; 422 per field | `core/main.py:247, 258` + `:148-174` | **Pass**, but see **S-1** (timing oracle). |
| §6 Data entities | `users` reused, DTO `{id, email}` | `core/main.py:263-272`, DDL in `core/seed.py:16-27` | **Pass** |
| §7 AC-1…AC-12 | All 12 ACs testable | 14 E2E + 14 pytest green (BUG_REPORT.md §"Round 2") | **Pass** |
| §8.1 Security baseline | bcrypt, HS256, 60min, identical creds error, no body logging, no hash in response | `core/main.py:34-36, 227-230, 246-272` | **Pass**, but see **S-1, S-2, S-8** |
| §8.2 Accessibility | Labels, keyboard tab order, role=alert, aria-invalid, aria-describedby, non-color cue | `admin/app/login/page.tsx:243-247, 284-334, 370-390` | **Pass** |
| §8.3 Performance / pending | Pending state ≤100ms after click | `admin/app/login/page.tsx:130, 338-343` + E2E-12 | **Pass** |
| §8.4 Reliability | Generic banner on any non-2xx/401/422 | `admin/app/login/page.tsx:198-201` | **Pass** |
| §8.5 Observability | MAY log non-sensitive auth events at INFO | **No logging anywhere.** `core/main.py` never emits. | **Deviation** — under-implemented (permissive spec language, but see Q-1). |
| §9 Out-of-scope | Registration, reset, SSO, MFA, remember-me, lockout, i18n, RBAC UI | None present | **Pass** |
| §10 Open questions | Session 60min / branding default / manual recovery | 60min enforced (`core/main.py:36`); branding uses Tailwind defaults; recovery not implemented (correct deferral) | **Pass** |

**Net:** full spec conformance with one under-implementation (§8.5 observability) and the S-1 timing caveat on §5.4.

---

## 7. QA History — Issue #37 and its Class

### 7.1 What happened
Round 1 E2E-01 / AC-1 failed: `document.activeElement?.id` was `""` instead of `"email"` on `/login` load. Issue #37 (`frontend`, severity:medium, closed at 2026-04-21T08:02:11Z) was filed with a correct root-cause hypothesis. Commit `94dc98c` fixed it by moving the focus call out of the `requestAnimationFrame` callback that flipped `checkingSession` and into its own `useEffect` gated on `checkingSession === false` (`admin/app/login/page.tsx:87-91`). Round 2 E2E-01 passed.

### 7.2 Class of bug: "same-frame ref access on a conditionally-rendered subtree"
The buggy code scheduled two operations in the same `rAF` callback:
1. `setCheckingSession(false)` — triggers a re-render that *will* mount `<input ref={emailRef}>`.
2. `emailRef.current?.focus()` — runs **immediately**, while the input is still unmounted (ref is `null`, `?.focus()` is a no-op).

The optional-chain quietly turned a timing bug into a silent no-op. The suite caught it only because an E2E test asserted `document.activeElement.id === "email"` with a fresh page load.

### 7.3 Recurrence-prevention playbook
- **Never read a ref from a DOM element that sits inside a conditional render subtree in the same effect that flipped the condition.** Split the effect. The fix at `admin/app/login/page.tsx:87-91` is the canonical pattern.
- **Prefer `autoFocus` for single-shot initial focus.** React handles it post-mount; no ref, no effect, no race. Using `autoFocus` on `admin/app/login/page.tsx:284` would have avoided the bug entirely, and the comment at `:83-86` acknowledges this.
- **When `?.focus()` is the right answer, assert its effect in a test that simulates a real page load.** `admin/e2e/login.spec.ts:59-62` is exactly that assertion; keep it.
- **Consider a targeted ESLint rule** flagging `*.current?.focus()` / `*.current?.scroll*()` in effects whose body also contains a state setter that affects conditional rendering. `eslint-plugin-react-hooks` doesn't catch this today; a small custom rule is tractable.

---

## 8. Future Directions (concrete, prioritized)

Ordered so that each item closes a specific gap from §2–§6. Items reference specific CLAUDE.md / spec sections.

### Tier 1 — before any non-dev deploy
1. **Fix bcrypt timing oracle (S-1).** Add `_DUMMY_HASH` module constant in `core/main.py` and always call `bcrypt.checkpw` before returning 401 on `user is None`. Covers §5.4 properly.
2. **Refuse default `JWT_SECRET` in production (S-2).** Add a startup guard in `core/main.py` near line 34.
3. **Rate limiting (S-3).** Add `slowapi` or nginx-level throttle for `POST /api/auth/login`; return 429 with the envelope. Track as a new phase task.
4. **Observability (§8.5 + Q-1).** Introduce structured logging in `core/main.py`: info on success (`user_id`), warning on credential failure (hashed email or email-only, never password), exception on the global handler. Feeds future rate-limiter decisions.

### Tier 2 — medium-term hardening
5. **Migrate access token to `HttpOnly; Secure; SameSite=Strict` cookie (S-4).** Requires a `/api/me` endpoint for the dashboard guard and CSRF for state-changing routes. Coordinates with Q-4 (extract `useSession()`).
6. **Token refresh endpoint.** Current 60-min JWT (TECH_SPEC §8.1) means silent session death mid-task. Add `POST /api/auth/refresh` with a separate refresh token (longer TTL, cookie-bound, rotating).
7. **JWT claims hardening (S-8).** Add `jti`, `iat`, `iss`, `aud`; persist `jti` for server-side revoke to support logout-everywhere.
8. **Integration test against a real Postgres fixture (§3.3).** One test that seeds a transactional user, hits the real pool via TestClient, asserts a real JWT comes back. Closes the `monkeypatch`-everywhere gap in `core/tests/test_auth.py`.
9. **Extract `useSession()` hook + shared API client (Q-4, Q-5).** Prepares for the second protected page without copying the guard.

### Tier 3 — feature / reach
10. **MFA (TOTP + optionally WebAuthn).** Out of PROTOTYPE §4 scope; track as next phase. `pyotp` is ~50 LoC + a new `user_totp_secret` column.
11. **Cross-browser Playwright matrix.** `admin/playwright.config.ts:18-23` is Chromium-only. Add Firefox + WebKit projects; gate `slowMo` behind a headed-mode env var (§P-3).
12. **Split `core/main.py` as soon as the next endpoint lands.** Move `login()` + `get_user_by_email()` into `core/routers/auth.py` and `core/db/users.py` respectively. Echoes CLAUDE.md "split into one router per domain".
13. **Raise bcrypt cost to 13 for admin-tier** (S-5). Small; pair with a one-time rehash-on-next-login migration.
14. **Tighten CORS when additional routes land** (S-6). Explicit methods / headers rather than `"*"`.

---

## 9. Artifacts Reviewed

- `.tasks/login-page/PROTOTYPE.md` (96 lines)
- `.tasks/login-page/TECH_SPEC.md` (352 lines)
- `.tasks/login-page/DB_SCHEMA.md` (130 lines)
- `.tasks/login-page/BACKEND_API.md` (283 lines)
- `.tasks/login-page/BUG_REPORT.md` — Round 1 + Round 2
- `.tasks/login-page/TEST_CASES.md` — 28 cases
- Backend: `core/main.py` (273), `core/database.py` (56), `core/seed.py` (72), `core/tests/test_auth.py` (268), `core/requirements.txt`, `core/pytest.ini`
- Frontend: `admin/app/page.tsx`, `admin/app/layout.tsx`, `admin/app/globals.css`, `admin/app/login/page.tsx` (403), `admin/app/dashboard/page.tsx` (113), `admin/e2e/login.spec.ts` (337), `admin/playwright.config.ts`
- GitHub issue #37 (CLOSED 2026-04-21T08:02:11Z, resolved by commit `94dc98c`)

No findings were gated on inaccessible sources; issue #37 was retrievable via `gh issue view 37`.
