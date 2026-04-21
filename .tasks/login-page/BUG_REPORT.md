# Bug Report — Login Page

**Task:** `.tasks/login-page`
**Branch:** `develop-blank-project`
**Tester:** qa-tester
**Latest round:** 2 · **Status:** SUITE GREEN · **Open issues:** 0

---

## Round 2 — re-run after fix for #37 (2026-04-21)

### Totals

| Layer                 | Total | Pass | Fail | Blocked |
|-----------------------|-------|------|------|---------|
| Backend (pytest)      | 14    | 14   | 0    | 0       |
| E2E (Playwright)      | 14    | 14   | 0    | 0       |
| **Total**             | **28** | **28** | **0** | **0** |

### What ran

- Backend: `cd core && source venv/bin/activate && pytest -v` → `14 passed in 4.15s`.
- E2E: `cd admin && npm run test:e2e` (committed headed `playwright.config.ts`, slowMo=2000, Chromium, 1440×900) → `14 passed (2.6m)`.

### Fixes verified

- **Issue #37** (`frontend`, severity:medium) — AC-1 autofocus — **CLOSED** by commit `94dc98c`. The frontend-developer moved `emailRef.current?.focus()` into a dedicated `useEffect` that depends on `checkingSession === false`, so focus now lands on `#email` after the form has mounted. `E2E-01 / AC-1` now passes (`document.activeElement.id === "email"` on `/login` load).

### Open issues

_None._ Zero open `frontend` / `backend` issues on the repo for this task.

### Green coverage (TECH_SPEC §7 AC-1…AC-12, plus backend contract)

- **Backend (14/14):** happy 200 + envelope + JWT claims; no-leak of `password_hash` / bcrypt `$2b$`; email trim+lowercase before lookup; 401 unknown email; 401 wrong password; 401 bodies byte-identical across both arms; 422 for every per-field message (`Email is required`, `Email is too long`, `Enter a valid email address`, `Password is required`, `Password must be at least 8 characters`, `Password is too long`); 422 multi-field collection.
- **E2E (14/14):** AC-1 autofocus, AC-2 `/`→`/login`, AC-3 happy login + `localStorage` + welcome, AC-4 wrong-password (pwd cleared, stays on /login) + AC-4 unknown-email (identical banner), AC-5 empty-email (no network) + AC-5 short-password (no network), AC-6 server-side 422 surfaced beneath fields, AC-7 unauthed `/dashboard`→`/login` (no flash), AC-8 signed-in `/login`→`/dashboard`, AC-9 logout clears storage and re-gates `/dashboard`, AC-10 pending state (disabled inputs + `aria-busy="true"` + "Signing in…"), AC-11 backend unreachable friendly banner, AC-12 password masked + never in localStorage + never echoed in response.

### Task

Task #7 (qa-tester) → **completed**.

---

## Round 1 — initial test pass after "frontend approved" (2026-04-21)

### Totals

| Layer                 | Total | Pass | Fail | Blocked |
|-----------------------|-------|------|------|---------|
| Backend (pytest)      | 14    | 14   | 0    | 0       |
| E2E (Playwright)      | 14    | 13   | 1    | 0       |
| **Total**             | **28** | **27** | **1** | **0** |

### Failures → GitHub issues (all since resolved)

| # | Case   | Severity | Layer    | Title | Link | Resolution |
|---|--------|----------|----------|-------|------|------------|
| 1 | E2E-01 | medium   | frontend | AC-1 autofocus broken: email input is never focused on `/login` load | https://github.com/nhanphcyberlogitec/demo1/issues/37 | Closed by commit `94dc98c` |

### Round 1 root-cause note (for the record)

In `admin/app/login/page.tsx`, the auth-check `useEffect` was scheduling `setCheckingSession(false)` **and** calling `emailRef.current?.focus()` inside the same `requestAnimationFrame` callback. While `checkingSession === true`, the form (and the ref'd `<input>`) was not mounted, so the ref was `null` and focus was a no-op; the subsequent render mounted the form but nothing moved focus to it. The fix moves the `.focus()` call into a second `useEffect` that runs once `checkingSession` becomes `false` — at which point the input is in the DOM and the ref resolves correctly.

---

## Environment (both rounds)

- Backend: FastAPI via `uvicorn main:app --reload` on `http://localhost:8000`.
- Frontend: Next.js dev server via `npm run dev` on `http://localhost:3000`.
- Database: PostgreSQL `localhost:5432` / `postgres`; `users` table present with seeded `admin@example.com` / `password123`.
- Playwright: committed `admin/playwright.config.ts` (headed, `slowMo: 2000`, Chromium, 1440×900). No override.
- Pytest: `core/tests/test_auth.py`, 14 cases. `get_user_by_email` stubbed, DB not required.

## Artifacts

- `TEST_CASES.md` — full case list with Round 1 + Round 2 status and issue links.
- `core/tests/test_auth.py` — 14 backend contract cases (TECH_SPEC §4 / §5, BACKEND_API §3 / §4 / §8).
- `admin/e2e/login.spec.ts` — 14 E2E specs mapped 1:1 to TECH_SPEC §7 AC-1…AC-12 (AC-4 and AC-5 each with two arms).
