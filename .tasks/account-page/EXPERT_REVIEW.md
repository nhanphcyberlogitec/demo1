# Account Page — Expert Review

**Document type:** Expert Review
**Author:** Reviewer Agent
**Date:** 2026-04-14
**Branch:** `develop-test-3`
**Source:** `PROTOTYPE.md`, `TECH_SPEC.md`, `DB_SCHEMA.md`, `BACKEND_API.md`, `BUG_REPORT.md` (all approved 2026-04-14); commits `80f0432` (backend), `06a2e53` (frontend).
**Gate:** QA green — 44 pytest + 18 Playwright, zero open issues.

---

## 1. Verdict

The feature meets the functional acceptance criteria in `TECH_SPEC §8`. The implementation is coherent, defensive in the right places (self-deactivation, `is_active` gate baked into `get_current_user`, password checked before `is_active` in login), and uses the DB indexes the data modeler provisioned. Findings below are grouped by concern and weighted **Critical / High / Medium / Low**. No Critical findings block a v1 merge on the `develop-test-3` branch, but the **one Critical item** (JWT secret) **must** be fixed before any non-dev deploy.

---

## 2. Security

### 2.1 Critical — hardcoded JWT secret

`core/main.py:18` — `SECRET_KEY = "super-secret-key-change-in-production"`. The literal even announces itself. Any process with source access — or anyone who has seen this repo — can mint admin tokens. Must be read from an environment variable (e.g. `os.environ["JWT_SECRET"]`) and fail-fast at import if unset. This is outside the Account Page scope but the Account Page routes all trust this secret, so the feature's security posture is bounded by it.

### 2.2 High — no login rate limiting

`POST /api/auth/login` (`core/main.py:190`) has no per-IP / per-email throttling. Combined with `bcrypt` it is not trivially brute-forceable, but the new inactive-user path (`main.py:211` → `main.py:214`) correctly keeps credential and account-state signals from being separately observable — good. Still, basic rate limiting (e.g. `slowapi` or a reverse-proxy rule) should land before public exposure.

### 2.3 High — token in `localStorage`

`admin/lib/api.ts:31` and `admin/app/accounts/page.tsx:52` store the JWT in `localStorage`. Any XSS in the admin bundle exfiltrates the token. For an admin surface this is the higher-risk XSS target. Preferred post-v1: `httpOnly; Secure; SameSite=Strict` cookie + CSRF token on mutating routes. Current CORS `allow_origins=["http://localhost:3000"]` (`core/main.py:32`) masks the risk in dev.

### 2.4 Medium — no role check on `/api/accounts*`

`get_current_user` (`core/main.py:111–155`) only checks "authenticated and active"; `list_accounts`, `create_account`, `update_account`, `update_account_status` do not gate on a role. This matches `TECH_SPEC §1.1` scope-decision #3 and `BACKEND_API §2`, but it means *every* row in `users` — even future non-admin users created via `POST /api/accounts` — gets full admin-panel access by default. The moment a non-admin is created (per `BR-6`), they can sign in and manage every account. Add an `is_admin` column (explicitly out of scope now per §9) or at minimum document this coupling in a README for whoever ships the first non-admin user.

### 2.5 Medium — self-protection is narrow

`core/main.py:798` blocks self-deactivation only. Two adjacent foot-guns remain once multiple admins exist: (a) admin A can deactivate admin B, locking B out mid-session (the inactive check in `get_current_user` at `main.py:144` makes this immediate — good hygiene, bad UX if done by mistake); (b) the last remaining active admin can be deactivated by a second admin, leaving the system with zero active operators. Consider a "last active admin" guard when the role model lands.

### 2.6 Low — PII in logs

`core/main.py:684` logs email on account create: `logger.info("account.created id=%s email=%s", row[0], email_value)`. For an admin panel this is probably desired (audit trail) but is PII; confirm with whoever owns log retention. The sibling `account.updated` log at `main.py:780–784` correctly logs only changed-field *keys*, not values — good.

### 2.7 Positive findings

- `ACCOUNT_SELECT_COLUMNS` (`core/main.py:489`) excludes `password_hash` from every list/detail path — can't leak by accident.
- `Cache-Control: no-store` is set on every account response via `NO_STORE_HEADERS` (`main.py:43`) — prevents intermediary caching of user lists.
- `get_current_user` re-reads `is_active` per request (`main.py:144`); a deactivated user's previously-issued token is invalidated immediately. This is stronger than what the spec demanded.
- Case-insensitive uniqueness is enforced both in application code (`main.py:663`, `756`) **and** the DB index `users_email_lower_key` (`core/seed.py:28`) — belt-and-braces.

---

## 3. Code Quality

### 3.1 High — duplication between `PATCH /api/account/me` and `PATCH /api/accounts/{id}`

`core/main.py:326–422` (self-profile) and `core/main.py:692–789` (admin edit) run near-identical code: detect-touched-fields, validate name/email, build `SET` clauses, duplicate-email pre-check, `UniqueViolation` fallback, commit, return DTO. Extract a `_update_user(id, patch)` helper that returns `(row | None, error)` and call it from both handlers. Keeps behaviour identical and halves the surface area for future bugs (e.g. the `EMAIL_IN_USE_MESSAGE` vs `DUPLICATE_EMAIL_MESSAGE` split below).

### 3.2 Medium — two distinct messages for the same error

`main.py:48` `EMAIL_IN_USE_MESSAGE = "Email already in use"` (used by `/api/account/me`) vs `main.py:52` `DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists"` (used by `/api/accounts*`). Pick one. The frontend already handles both by displaying `body.message` verbatim, so there is no behavioural bug today — just a copy inconsistency waiting to ship as a UX nit.

### 3.3 Medium — raw-body re-parse to detect present-but-null fields

`update_account` at `core/main.py:699` does `body = await raw.json() ...` and then checks `"name" in body` / `"email" in body` because Pydantic defaults both to `None`. The same pattern appears at `main.py:332`. This works, but re-reading the body twice (Pydantic + our `await raw.json()`) is fragile and costs an extra JSON parse per request. Pydantic v2 exposes `payload.model_fields_set` — use it:

```python
updates_requested = payload.model_fields_set
if "name" in updates_requested: ...
```

### 3.4 Medium — `core/main.py` is 831 lines of mixed concerns

Project CLAUDE.md explicitly flags this: *"as it grows, split into one router per domain."* The Account Page work added ~300 lines to an already-growing file. Split into `core/routers/auth.py`, `core/routers/profile.py`, `core/routers/accounts.py`, and a `core/deps.py` for `get_current_user` / envelope helpers / exception handlers. Do this before the next feature lands; every new domain makes the split harder.

### 3.5 Medium — frontend duplication

Three pages each reimplement the same chrome:
- Top nav with Admin Panel / Dashboard / Accounts links: `admin/app/accounts/page.tsx:163–182`, `admin/app/accounts/[id]/page.tsx:272–284`, `admin/app/accounts/new/page.tsx:140–152`.
- Toast banner: `admin/app/accounts/page.tsx:186–194`, `admin/app/accounts/[id]/page.tsx:295–303`.
- Auth-guard `useEffect`: near-identical in all three pages (`page.tsx:51–73`, `[id]/page.tsx:65–82`, `new/page.tsx:52–60`).
- Confirmation dialog: inline-only in `[id]/page.tsx:446–492`.

Extract `<AppHeader />`, `<Toast />`, `<ConfirmDialog />`, and a `useAuthGuard()` hook under `admin/app/_components/` (or similar). This is a refactor, not a behaviour change — current tests should pass unchanged.

### 3.6 Low — dead code / comment noise

- `admin/app/accounts/page.tsx:127–129`: a conditional block with only a comment, no logic. Delete.
- `core/main.py:744–750`: wraps `SELECT 1 FROM users WHERE id = %s` in a try/except for `InvalidTextRepresentation`, but `_fetch_account` at `main.py:599–613` already encapsulates the same pattern. Re-use it: `if _fetch_account(account_id) is None: return _not_found_response()`.
- `admin/app/accounts/[id]/page.tsx:33–40` `formatTimestamp` displays UTC unconditionally; most admin users will expect their local timezone. Low priority; fix with `toLocaleString()` once a locale decision is made.

### 3.7 Low — `status_` alias

`core/main.py:533`: `status_: Optional[str] = Query(default="all", alias="status")`. Trailing-underscore is there because `status` is the FastAPI symbol imported at `main.py:9`. Consider `from fastapi import status as http_status` and freeing up the nicer name, or keep as-is and add an inline note. Minor.

---

## 4. Architecture

### 4.1 Three layers collapsed into one

Route handlers in `core/main.py` mix HTTP parsing, Pydantic validation, business rules (self-deactivation), SQL, envelope shaping, and logging. At the current scale it is readable; beyond two more features it will not be. When splitting per §3.4, also introduce a thin data module (`core/repositories/users.py`) so tests can mock DB access and route logic stays about HTTP.

### 4.2 No shared API client abstraction on the frontend

`admin/lib/api.ts` is good — one `apiFetch` with centralised 401 handling (`api.ts:46–48`). But callers still hand-build URLs and methods everywhere (`page.tsx:105`, `[id]/page.tsx:91`, `145`, `195`, `new/page.tsx:86`). A next step is a typed façade: `accountsApi.list(params)`, `accountsApi.get(id)`, `accountsApi.patch(id, body)`, `accountsApi.setStatus(id, active)`. Removes stringly-typed URL duplication and couples types to one module. Worth doing before a second domain (e.g. audit log) lands.

### 4.3 Pagination strategy

Offset pagination (`LIMIT/OFFSET` at `main.py:580`) is correct for v1 at low volume. Note the known limitation: if rows are inserted while a user pages, they will see dupes/skips. The `ORDER BY created_at DESC, id DESC` at `main.py:580` is stable (tie-break on id), so switching to keyset pagination is straightforward later.

---

## 5. Performance

### 5.1 Two round-trips per list page

`list_accounts` at `main.py:575` and `main.py:578` runs `COUNT(*)` and the page `SELECT` as separate queries sharing the same `WHERE`. At 2 rows this is irrelevant. At 10k+ rows with a trigram filter, it doubles the work. Options:
- Use a window count in one statement: `SELECT ..., COUNT(*) OVER () AS total FROM users WHERE ... LIMIT %s OFFSET %s`.
- Or skip total for large tables and return `has_next`.

Defer until volume forces it; flag it before shipping multi-tenant.

### 5.2 Trigram index usage

`DB_SCHEMA.md §3` provisions `idx_users_email_trgm` and `idx_users_name_trgm` as GIN with `gin_trgm_ops` over `lower(name)` / `lower(email)`. `list_accounts` at `main.py:565–567` builds `LOWER(name) LIKE %s OR LOWER(email) LIKE %s` with a `%term%` pattern. Postgres's `pg_trgm` GIN does accelerate unanchored `LIKE`, so the indexes are live. Verify once with `EXPLAIN` on a loaded dev DB to confirm index usage instead of sequential scan — particularly for the combined `OR` predicate (sometimes planner picks seq scan for small tables).

### 5.3 Per-request user fetch

`get_current_user` (`main.py:128–138`) hits the DB on every protected request to re-check `is_active`. Correct for security but a latency floor. Acceptable now; if it becomes hot, cache with a short TTL keyed on `sub` and invalidate on status change.

### 5.4 Frontend: debounce + request cancellation

`admin/app/accounts/page.tsx:77–80` (300 ms debounce) plus the `fetchCounter.current` guard at `page.tsx:93–108` cleanly discards stale responses — this is the right shape and defends against the classic "type fast, first response wins" race. Nicely done.

---

## 6. Spec Conformance

Cross-checked against `TECH_SPEC §2–8` and `BACKEND_API §4`.

| Check | Status | Evidence |
|---|---|---|
| `GET /api/accounts` shape + pagination + filters | ✅ | `main.py:530–596` matches `BACKEND_API §4.1`. |
| `GET /api/accounts/{id}` 404 on bad UUID (not 500) | ✅ | `_fetch_account` swallows `InvalidTextRepresentation` at `main.py:608–610`. |
| `POST /api/accounts` 201 + duplicate → 409 | ✅ | `main.py:684–689`, duplicate paths at `main.py:666`, `main.py:676`. |
| `PATCH /api/accounts/{id}` partial + empty-body 422 | ✅ | `main.py:726–727`. |
| `PATCH /api/accounts/{id}/status` self-deactivation → 403 | ✅ | `main.py:798–803`. Self-reactivation still allowed (spec-compliant). |
| Login: password checked before `is_active` | ✅ | `main.py:211` precedes `main.py:214` — matches `BACKEND_API §4.6`. Stronger than `TECH_SPEC §5.6` (which was silent on order); good call. |
| `password_hash` never in a response | ✅ | `ACCOUNT_SELECT_COLUMNS` at `main.py:489` omits it; `get_current_user` uses it only for bcrypt comparison in `post_account_password` (`main.py:448–451`). |
| Frontend self-deactivate disabled w/ tooltip | ✅ | `admin/app/accounts/page.tsx:302–308`, `[id]/page.tsx:321–327`. |
| Confirmation dialog copy | ✅ | `[id]/page.tsx:453–463` matches `TECH_SPEC §2.4`. |

### Minor drifts (non-blocking)

- `TECH_SPEC §5.6` message `"Account is inactive."` (trailing period) vs implemented `"Account is inactive"` (no period) at `main.py:46`. QA accepted as-is; update the spec or the constant — pick one.
- `TECH_SPEC §6.1` caps `email` at 255 chars. There is no explicit length check in `CreateAccountRequest`/`UpdateAccountRequest`; the `varchar(255)` column will trip a DB error before Pydantic rejects it. Add `EmailStr` + length validator for a clean 422 path.
- `TECH_SPEC §2.2` says "Disabled self-deactivation: … button is disabled *with a tooltip*." Implemented via `title={...}` (`[id]/page.tsx:323–327`), which is fine but native tooltips are unreliable on touch and do not meet WCAG 1.4.13. Consider a real tooltip primitive long-term.

---

## 7. Testing Posture

QA delivered 44 backend + 18 E2E green (`BUG_REPORT.md §1`). Observations on coverage gaps worth adding in a follow-up (not v1 blockers):

- No test asserts `Cache-Control: no-store` on account responses — trivial to add to any existing test.
- No test covers the `updated_at` trigger (`core/seed.py:42–46`) actually firing on `PATCH`. Easy regression to introduce via future refactor.
- No concurrent-write test for duplicate-email race between two `POST /api/accounts` with the same email; today the `users_email_lower_key` unique index is the final defence (`main.py:676` catches `UniqueViolation`) but a dedicated test documents intent.
- `BUG_REPORT §4` notes Playwright needs `--workers=1` to avoid Next dev-server stutter. Codify by setting `fullyParallel: false` or `workers: 1` in `admin/playwright.config.ts`; otherwise the next contributor rediscovers this.

---

## 8. Future Directions

Ordered by estimated payoff for effort:

1. **Promote `SECRET_KEY` to env var** — 10-minute change, eliminates the Critical finding (§2.1). Do this first.
2. **Split `core/main.py` into routers** (§3.4). Unblocks every future backend feature and makes §3.1 deduplication tractable.
3. **Extract shared frontend primitives** (§3.5): `AppHeader`, `Toast`, `ConfirmDialog`, `useAuthGuard`. Pays for itself on the next page.
4. **Introduce `is_admin` flag** to the `users` table. The Account Page already creates "users" per `BR-6`; without a role distinction, every created account is a silent admin (§2.4). Schedule alongside the next feature that needs a non-admin user.
5. **Login rate limiting** + move token to `httpOnly` cookie (§2.2, §2.3). Prerequisite for any non-dev deployment.
6. **Audit log** (deferred in `TECH_SPEC §9`). The backend already emits structured info logs (`main.py:684`, `780`, `826`) — formalise them into a durable table so the UI can surface them later.
7. **Admin-driven password reset** (deferred in `TECH_SPEC §9`). Today an admin can deactivate but not help a locked-out user recover.
8. **Last-active-admin guard** (§2.5). Cheap insurance once the role model exists.
9. **Optimistic concurrency on `PATCH /api/accounts/{id}`** via `If-Match: <updated_at>` or a `version` column. Currently two admins editing the same user silently last-write-wins. Not urgent at one-admin scale.
10. **Window-count pagination** (§5.1) when the table grows past ~10k rows.

---

## 9. Sign-off

Feature is functionally complete per `TECH_SPEC §8` and QA-green. Merge of `develop-test-3` is acceptable **provided §2.1 (JWT secret) is resolved before any environment beyond local dev**. The remaining High-severity items (§2.2, §2.3, §3.1, §3.4, §3.5) should be addressed in the next cycle — none require rework on this feature, but together they describe the technical debt this sprint added and how to pay it down before the next feature compounds it.
