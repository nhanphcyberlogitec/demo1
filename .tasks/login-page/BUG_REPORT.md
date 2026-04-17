# BUG_REPORT.md — QA Round 3 (final)

**Date:** 2026-04-14
**Tester:** QA Tester Agent
**Branch:** `develop-test-3` (HEAD: f1e674b)
**Sources:** PROTOTYPE.md v1.0, TECH_SPEC.md v1.0, BACKEND_API.md v1.0, DB_SCHEMA.md v1.0
**Status:** **PASS — zero open issues**

---

## 1. Issue verification

| Issue | Title                                                                     | Round-1 | Round-2 | Round-3 |
|-------|---------------------------------------------------------------------------|---------|---------|---------|
| #26   | 422 missing `Cache-Control: no-store`                                     | FAIL    | PASS    | PASS    |
| #27   | Focus not on Password after failed login                                  | FAIL    | FAIL (→ #29) | —  |
| #28   | Password placeholder not empty                                            | FAIL    | PASS    | PASS    |
| #29   | Focus still not on Password (regression of #27, Sign In click path)       | —       | FAIL    | **PASS** |

## 2. Full re-test — all cases

### Backend (`core/`, http://127.0.0.1:8000)

| ID   | Case                                          | Result |
|------|-----------------------------------------------|--------|
| B-1  | Valid login → 200 + JWT + user                | PASS |
| B-2  | Wrong password → 401 generic                  | PASS |
| B-3  | Unknown email → 401 generic                   | PASS |
| B-4  | Inactive user → 401 generic                   | PASS |
| B-5  | Malformed email → 422                         | PASS |
| B-6  | Short password → 422                          | PASS |
| B-7  | Missing field → 422                           | PASS |
| B-8  | Envelope shape `{success,data,message}`       | PASS |
| B-9  | `Cache-Control: no-store` on 200/401/422      | PASS |
| B-10 | CORS preflight for localhost:3000             | PASS |

### Frontend (`admin/`, http://localhost:3000)

| ID   | Case (AC)                                                              | Result |
|------|------------------------------------------------------------------------|--------|
| F-1  | `/` → `/login` (AC-11)                                                 | PASS |
| F-2  | Form structure + title "Admin Panel" (AC-1)                            | PASS |
| F-3  | Email input attrs per TECH_SPEC §2.2                                   | PASS |
| F-4  | Password input attrs, empty placeholder (TECH_SPEC §2.2)               | PASS |
| F-5  | Empty Email → inline "Email is required." (AC-2)                       | PASS |
| F-6  | Empty Password → inline "Password is required." (AC-3)                 | PASS |
| F-7  | Malformed email → "Enter a valid email address." (AC-4)                | PASS |
| F-8  | Short password → "Password must be at least 6 characters." (AC-5)      | PASS |
| F-9  | Valid creds → 200, localStorage populated, redirect to /dashboard (AC-6) | PASS |
| F-10 | Wrong creds → 401 + banner "Invalid email or password" (AC-7)          | PASS |
| F-11 | After fail: email retained, password cleared                           | PASS |
| F-12 | After fail: focus moves to Password via Sign In click (AC-9)           | PASS |
| F-13 | Already-authenticated → redirect /dashboard (AC-10)                    | PASS |
| F-14 | Password masked (AC-14)                                                | PASS |
| F-15 | Labels associated via htmlFor/id                                       | PASS |

## 3. Open GitHub issues

None.

## 4. Minor UX observations (not filed)

- When a previously-shown form-level banner is present and the user re-submits with empty fields, the banner text lingers alongside the inline validation errors until the next network response. Not a spec violation — ACs only require inline errors to appear — but a future UX polish opportunity.

## 5. Environment

- Backend: `uvicorn main:app --loop asyncio --http h11` on `127.0.0.1:8000`
- Frontend: `npm run dev` on `localhost:3000`
- PostgreSQL: `localhost:5432/postgres`, seeded via `python seed.py`

## 6. Verdict

**PASS** — all acceptance criteria met, all filed issues closed. Login feature is ready for expert review (task #8).
