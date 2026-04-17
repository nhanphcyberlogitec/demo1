# Account Page — QA Bug Report

**Author:** QA Tester Agent
**Date:** 2026-04-15
**Branch:** `develop-test-3`
**Round:** Phase-5 QA pass on account management pages (Round 2 — after global-setup cleanup)

---

## 1. Summary

| Layer       | Suite                              | Total | Passed | Failed |
|-------------|------------------------------------|-------|--------|--------|
| Backend     | `core/tests/test_accounts.py`      | 44    | 44     | 0      |
| Frontend E2E| `admin/e2e/accounts.spec.ts`       | 18    | 18     | 0      |
| **TOTAL**   |                                    | **62**| **62** | **0**  |

GitHub issues filed: **0**. All product behavior conforms to PROTOTYPE.md / TECH_SPEC.md / BACKEND_API.md.

---

## 2. Backend results — `pytest -v`

All 44 tests passed (9.75s):

- `TestAuthGate` (7) — every `/api/accounts*` route returns 401 without a valid Bearer token.
- `TestListAccounts` (7) — happy path, status filter `active|inactive`, invalid status → 422, search by email substring, page/page_size validation.
- `TestGetAccount` (3) — happy path, missing UUID → 404, malformed UUID → 404.
- `TestCreateAccount` (10) — happy path, default `is_active`, duplicate email (incl. case-insensitive) → 409, bad email/password/name → 422.
- `TestUpdateAccount` (7) — partial PATCH for `name` and `email`, 404 on missing/malformed id, 409 on collision, 422 on empty body / bad email.
- `TestUpdateStatus` (8) — deactivate / activate happy paths, self-deactivation → 403, self-activation allowed, 404 on missing/malformed id, 422 on missing/non-boolean `is_active`.
- `TestLoginInactiveGate` (2) — inactive user receives `401 "Account is inactive"` after deactivation; wrong password on inactive user still returns the generic `Invalid email or password` (proves password is checked before `is_active`, so existence of an inactive account is not leaked).

DTO contract verified: `password_hash` is never present in any response; envelope shape `{success, data, message}` enforced everywhere.

> Warnings observed but non-blocking: starlette `HTTP_422_UNPROCESSABLE_ENTITY` deprecation in `core/main.py` (use `HTTP_422_UNPROCESSABLE_CONTENT`). Not a functional bug; can be cleaned up in a follow-up.

## 3. Frontend E2E results — `npx playwright test e2e/accounts.spec.ts`

**18/18 passed** (≈2.7 min, headed Chromium).

Passing scenarios cover: list header + toolbar + columns + admin row visibility, search debounce, status filter, empty-state copy, auth redirects on `/accounts`, `/accounts/[id]`, `/accounts/new`, edit name with success toast, duplicate-email field error on edit, Cancel revert, deactivate → confirm dialog → status updates, Cancel-on-dialog aborts, self-deactivate disabled with tooltip, invalid email blocks submit, create + toast + new row visible, duplicate email on create, confirm-password mismatch and short-password client-side blocks.

### 3.1 Test isolation — global-setup cleanup (added Round 2)

- **File added:** `admin/e2e/global-setup.ts` — invokes `psql` to `DELETE FROM users WHERE LOWER(email) LIKE` any of `e2e-%`, `srch-%`, `new-%`, `mm-%`, `short-%` `@example.com` before the suite starts.
- **Wired:** `admin/playwright.config.ts` now declares `globalSetup: "./e2e/global-setup.ts"`.
- **Effect on Round 2 run:** prune deleted 76 leftover rows; `renders header, toolbar, and columns` (which previously failed because the seeded admin had been paginated to page 4) now passes — admin@example.com appears on page 1, suite is 18/18 green.
- **DB credentials:** picked up from env vars `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` with the same defaults as `core/database.py` (`localhost:5432/postgres`, `postgres`/`postgres`).

## 4. GitHub issues filed

None. All product-level acceptance criteria (AC-1 through AC-7 in TECH_SPEC §8) are met.

## 5. Sign-off

Backend: **PASS** (44/44).
Frontend: **PASS** (18/18).

Recommendation: proceed to reviewer phase.
