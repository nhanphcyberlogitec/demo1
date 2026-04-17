# Account Page — Functional / Technical Specification

**Document type:** Functional Document Specification
**Status:** Draft — pending user review
**Author:** Technical Writer Agent
**Date:** 2026-04-14
**Source:** `PROTOTYPE.md` (Business Requirements, approved 2026-04-14)

---

## 1. Overview

This document translates the approved Business Requirements for the Account Page into a functional/technical specification that the data modeler, backend developer, and UI designer can build from. It specifies screens, user flows, data entities, REST API surface, validation rules, auth rules, and acceptance criteria.

### 1.1 Scope decisions (from approved PROTOTYPE)
1. **Deactivate only** in v1 — no hard delete.
2. **Admin-driven password reset:** out of scope for v1.
3. **Is-admin flag management:** out of scope. All listed users are treated as regular users; admin role is implicit for the logged-in session.
4. **Self-protection:** an admin may not deactivate their own account.
5. **Account creation:** in scope for v1.
6. **Audit trail UI:** deferred.

### 1.2 Stack context
- Frontend: Next.js 16 App Router under `admin/` (React 19, TypeScript, Tailwind v4, client components).
- Backend: FastAPI under `core/` (Python 3.12, psycopg2, JWT via python-jose, bcrypt).
- Database: PostgreSQL (`users` table).
- API response envelope: `{ success: boolean, data: object|null, message: string }`.
- Auth: JWT bearer token stored in `localStorage` under key `token`; sent as `Authorization: Bearer <token>` on protected requests.

---

## 2. Screens / Views

All screens live inside the admin panel and require an authenticated session. Unauthenticated access redirects to `/login`, consistent with the existing auth-guard pattern on `/dashboard`.

### 2.1 Account List — `/accounts`

**Purpose:** BR-1, BR-2. Primary landing page for account management.

**Layout:**
- Page header: "Accounts" title, "+ New account" primary button (top-right).
- Toolbar:
  - Search input — placeholder "Search by name or email", debounced (300 ms).
  - Status filter — select with options `All` (default), `Active`, `Inactive`.
- Data table with columns:
  - Name
  - Email
  - Status (badge: green "Active" / gray "Inactive")
  - Created (formatted date, e.g. `2026-04-14`)
  - Actions — "View" link (opens detail) and a status toggle control (Activate / Deactivate)
- Empty state: "No accounts match your filters."
- Pagination: page-size 20, with `Previous` / `Next` buttons and a "Page N of M" indicator.
- Loading state: skeleton rows while data loads.
- Error state: inline banner with error message and "Retry" button.

### 2.2 Account Detail — `/accounts/[id]`

**Purpose:** BR-3, BR-4, BR-5. Read + edit a single account.

**Layout:**
- Back link to `/accounts`.
- Header: user name + status badge.
- Metadata block (read-only): ID, Created at, Updated at.
- Editable form fields:
  - Name (text, required)
  - Email (text, required, email format)
- Action buttons:
  - `Save` — submits profile edits (disabled while clean / submitting).
  - `Cancel` — reverts edits to last saved state.
  - `Deactivate` (if currently active) / `Activate` (if currently inactive) — opens a confirmation dialog before calling the API.
- Inline field-level validation messages; top-of-form banner for server errors.
- Disabled self-deactivation: when the detail page belongs to the currently authenticated admin, the Deactivate button is disabled with a tooltip: "You cannot deactivate your own account."

### 2.3 Create Account — `/accounts/new`

**Purpose:** BR-6.

**Layout:**
- Header: "New account".
- Form fields:
  - Name (text, required)
  - Email (text, required, email format, unique)
  - Password (password, required, min 8 chars, must include at least one letter and one digit)
  - Confirm password (password, must match Password)
  - Status (select: Active / Inactive, default Active)
- Action buttons: `Create` (primary), `Cancel` (returns to list without saving).
- On success: toast "Account created" and redirect to `/accounts`.
- On validation failure: field-level errors; duplicate email surfaces a banner "An account with this email already exists."

### 2.4 Confirmation Dialog (shared)

Modal used for status changes:
- Title: "Deactivate account?" or "Activate account?"
- Body: "User <name> (<email>) will " + either "no longer be able to sign in." or "be able to sign in again."
- Buttons: `Cancel` (secondary), `Confirm` (primary — destructive red for deactivate).

---

## 3. User Flows

### 3.1 View account list (BR-1, BR-2)
1. Admin lands on `/accounts` from the dashboard nav.
2. Frontend reads `token` from `localStorage`; if missing, redirects to `/login`.
3. Frontend calls `GET /api/accounts?page=1&page_size=20`.
4. Table renders rows; toolbar controls re-fetch with query params on change.

### 3.2 Search & filter (BR-2)
1. Admin types in search box → after 300 ms debounce, fetch `GET /api/accounts?q=<term>&status=<filter>&page=1`.
2. Table replaces contents; pagination resets to page 1.

### 3.3 View and edit an account (BR-3, BR-4)
1. Admin clicks "View" on a row → navigates to `/accounts/[id]`.
2. Frontend calls `GET /api/accounts/{id}`; fills form fields.
3. Admin edits Name / Email; clicks Save.
4. Frontend calls `PATCH /api/accounts/{id}` with changed fields.
5. On 200, show success toast "Changes saved"; update local state.
6. On 409 (duplicate email), show field-level error under Email.
7. On 422, show field-level validation errors.

### 3.4 Deactivate / activate an account (BR-5)
1. Admin clicks `Deactivate` (or `Activate`) on the detail page.
2. Confirmation dialog appears.
3. On confirm, frontend calls `PATCH /api/accounts/{id}/status` with `{ is_active: false }` (or `true`).
4. Backend returns updated user; UI updates badge + button label.
5. If the target user tries to sign in while inactive, `POST /api/auth/login` returns `401` with message "Account is inactive."

### 3.5 Create a new account (BR-6)
1. Admin clicks "+ New account" on the list page.
2. Navigates to `/accounts/new`; fills form.
3. Submit calls `POST /api/accounts`.
4. On 201, toast success and redirect to `/accounts`.
5. On 409 duplicate email or 422 validation error, surface error messages.

### 3.6 Self-protection (scope decision #4)
1. Admin tries to deactivate their own account (from detail page, or via direct API call).
2. UI: button is disabled; API call — should one be issued anyway — returns `403` with message "You cannot deactivate your own account."

### 3.7 Auth failure / session expiry
1. Any protected API call returning `401` clears `token` + `user` from `localStorage` and redirects to `/login`.

---

## 4. Data Entities

### 4.1 `users` table (extended)

Builds on the existing schema from `core/seed.py`. Adds `is_active`.

| Column        | Type                    | Constraints                          | Notes                                              |
|---------------|-------------------------|--------------------------------------|----------------------------------------------------|
| `id`          | `uuid`                  | PK, default `gen_random_uuid()`      | Existing.                                          |
| `email`       | `varchar(255)`          | NOT NULL, UNIQUE, case-insensitive   | Existing. Store normalized (lowercased).           |
| `password_hash` | `varchar(255)`        | NOT NULL                             | Existing. bcrypt hash. Never returned by the API.  |
| `name`        | `varchar(100)`          | NOT NULL                             | Existing.                                          |
| `is_active`   | `boolean`               | NOT NULL, default `true`             | **New.** Drives status filter and login gating.    |
| `created_at`  | `timestamp with tz`     | NOT NULL, default `now()`            | Existing.                                          |
| `updated_at`  | `timestamp with tz`     | NOT NULL, default `now()`            | Existing. Update on every write.                   |

**Indexes:**
- Existing PK on `id`, unique on `lower(email)`.
- New: `idx_users_is_active` on `(is_active)` — supports status filter.
- New: `idx_users_name_trgm` on `name` using `gin (name gin_trgm_ops)` **or** a simpler `idx_users_name_lower` on `lower(name)` — enables name search. Data modeler chooses based on expected volume (pg_trgm is preferred for partial-match search).

**Migration notes:**
- Add `is_active` with default `true` (safe for existing rows).
- Update `seed.py` to insert `is_active=true` for the default admin.

### 4.2 API-level "User" DTO

Shape returned by all account endpoints (never includes `password_hash`):

```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "is_active": true,
  "created_at": "2026-04-14T10:00:00Z",
  "updated_at": "2026-04-14T10:00:00Z"
}
```

---

## 5. API Surface

All endpoints are under prefix `/api/accounts`, require a valid JWT in `Authorization: Bearer <token>`, and return the envelope `{ success, data, message }`. Authentication failures return `401`; the updated login endpoint rejects inactive users with `401`.

### 5.1 `GET /api/accounts`

List accounts (paginated, filtered).

**Query params:**
- `q` — optional string, matches name or email (case-insensitive partial match).
- `status` — optional enum: `active` | `inactive` | `all` (default `all`).
- `page` — optional integer ≥ 1, default `1`.
- `page_size` — optional integer 1–100, default `20`.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "items": [ /* User DTO */ ],
    "page": 1,
    "page_size": 20,
    "total": 135
  },
  "message": ""
}
```

### 5.2 `GET /api/accounts/{id}`

Fetch a single account.

**Response `200`:**
```json
{ "success": true, "data": { /* User DTO */ }, "message": "" }
```
**`404`** when not found: `{ "success": false, "data": null, "message": "Account not found" }`.

### 5.3 `POST /api/accounts`

Create a new account.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "correcthorse1",
  "is_active": true
}
```

**Responses:**
- `201`: `{ success: true, data: User, message: "Account created" }`.
- `409`: duplicate email — `{ success: false, data: null, message: "An account with this email already exists" }`.
- `422`: validation error — `{ success: false, data: null, message: "<field>: <reason>" }`.

### 5.4 `PATCH /api/accounts/{id}`

Edit basic profile fields. Partial update: only fields included in the body are updated.

**Request body (all optional, at least one required):**
```json
{ "name": "Jane D.", "email": "jane.d@example.com" }
```

**Responses:**
- `200`: `{ success: true, data: User, message: "Changes saved" }`.
- `404` not found.
- `409` duplicate email.
- `422` validation error.

### 5.5 `PATCH /api/accounts/{id}/status`

Change activation status.

**Request body:**
```json
{ "is_active": false }
```

**Responses:**
- `200`: `{ success: true, data: User, message: "Account deactivated" | "Account activated" }`.
- `403`: self-deactivation attempt — `{ success: false, data: null, message: "You cannot deactivate your own account" }`.
- `404` not found.
- `422` validation error.

### 5.6 `POST /api/auth/login` — update

Existing endpoint gains inactive-user check.

- If user's `is_active = false`, return `401` with message "Account is inactive" (do not issue a token).
- All other behavior unchanged.

---

## 6. Validation Rules

### 6.1 Field-level
| Field      | Rule                                                                                          |
|------------|-----------------------------------------------------------------------------------------------|
| `email`    | Non-empty; valid RFC-5322 email format; max 255 chars; stored lowercased; unique (case-insensitive). |
| `name`     | Non-empty; trimmed length between 1 and 100 chars.                                            |
| `password` (create only) | Non-empty; min length 8; max length 128; must contain at least one letter and one digit. |
| `is_active`| Boolean.                                                                                      |
| `q`        | Trimmed; max 100 chars.                                                                       |
| `status`   | One of `active`, `inactive`, `all`.                                                           |
| `page`     | Integer ≥ 1.                                                                                  |
| `page_size`| Integer 1–100.                                                                                |

### 6.2 Cross-field / business rules
- **Unique email:** case-insensitive uniqueness enforced at the API and by a unique index on `lower(email)`.
- **Self-deactivation blocked:** `PATCH /api/accounts/{id}/status` where `id == <jwt.sub>` and body is `{ is_active: false }` → `403`.
- **Inactive login blocked:** `POST /api/auth/login` rejects users where `is_active = false`.
- **Password never returned:** `password_hash` must never appear in any API response or log line.

### 6.3 Error message format
Validation errors follow the existing envelope: `{ success: false, data: null, message: "<human-readable reason>" }`. Where multiple fields are invalid, the message lists the first failing field; the frontend also relies on field-level error surfacing via the known 422 convention.

---

## 7. Auth Rules

- **Protected surface:** every `/api/accounts*` route requires a valid, unexpired JWT.
  - Missing / malformed / expired token → `401 { success: false, data: null, message: "Not authenticated" }`.
- **Identity:** the authenticated admin's `id` is taken from the JWT `sub` claim and used for the self-protection check.
- **Authorization model (v1):** any authenticated user of the admin panel may call any `/api/accounts*` endpoint. No role check beyond "logged in" (per scope decision #3).
- **Session on frontend:** `/accounts*` pages apply the same `localStorage` auth guard as `/dashboard`; a 401 from any call clears local storage and redirects to `/login`.
- **CORS:** unchanged — only `http://localhost:3000` origin permitted.
- **Sensitive data:** `password_hash` is never exposed; `password` is write-only on create.

---

## 8. Acceptance Criteria (per flow)

### AC-1 — Access the account list (BR-1)
- Navigating to `/accounts` without a token redirects to `/login`.
- With a valid token, the table renders within one request cycle and shows name, email, status, and created date for each user.
- The default page returns up to 20 rows and reports accurate `total`.

### AC-2 — Find a specific account (BR-2)
- Typing a substring of a user's name or email filters results within 500 ms of the last keystroke.
- The status filter narrows results to `Active` / `Inactive` / all.
- Changing filters resets pagination to page 1.
- When no rows match, the empty state is displayed.

### AC-3 — View account details (BR-3)
- Clicking a row opens `/accounts/[id]` pre-populated with `name`, `email`, `is_active`, `created_at`, `updated_at`.
- The API never returns a password hash.

### AC-4 — Edit profile (BR-4)
- Saving a valid change updates the user and shows a success toast; the list reflects the change on return.
- Submitting an invalid email shows a field-level error and does not call the API.
- Submitting a duplicate email returns `409` and surfaces an email-field error.
- Cancel returns the form to the last-saved values.

### AC-5 — Activate / deactivate (BR-5)
- Toggling status opens a confirmation dialog; cancelling aborts.
- Confirming sends `PATCH /api/accounts/{id}/status` and updates the status badge on success.
- A deactivated user attempting `POST /api/auth/login` receives `401` with message "Account is inactive" and no token.
- Attempting to deactivate oneself returns `403`; the UI button for the own account is disabled.

### AC-6 — Create account (BR-6)
- Submitting a valid form creates the account and redirects to `/accounts` with the new row visible.
- Duplicate email → `409`, surfaced inline.
- Password shorter than 8 chars or missing a letter/digit → `422`, surfaced inline.
- Confirm-password mismatch is blocked client-side before submit.

### AC-7 — Security (BR-7)
- Every `/api/accounts*` request without a valid JWT returns `401`.
- No API response includes `password_hash`.
- Page routes under `/accounts` perform the auth-guard redirect before fetching data.

---

## 9. Out of Scope (deferred)

- Hard delete of users.
- Admin-driven password reset / change flows.
- Role-based access control beyond "authenticated admin".
- Audit log / change history UI.
- Bulk operations (import, export, multi-select actions).
- MFA management and user impersonation.

---

## 10. Open Items for Downstream Agents

- **Data modeler:** finalize the search index choice (`pg_trgm` vs. `lower(name)`); deliver the migration script adding `is_active` and the index.
- **Backend developer:** implement the six endpoints in section 5; wire JWT dependency injection for route protection; add the inactive-user check to login.
- **UI designer:** produce Figma frames for list, detail/edit, create, and the confirmation dialog, matching the existing login/dashboard visual language.

---

**Review requested.** Please review `TECH_SPEC.md` and confirm before the data-modeler / backend-developer / ui-designer agents begin.
