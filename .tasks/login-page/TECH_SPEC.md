# Login Page — Functional & Technical Specification (TECH_SPEC)

**Task:** `.tasks/login-page`
**Source:** `.tasks/login-page/PROTOTYPE.md` (approved business requirements)
**Audience:** data-modeler, backend-developer, ui-designer, frontend-developer, qa-tester
**Stack constraints:** Next.js 16 App Router (TypeScript, Tailwind CSS v4, React 19) under `admin/`; FastAPI (Python 3.12, psycopg2 ThreadedConnectionPool) under `core/`; existing JWT (python-jose) + bcrypt; API envelope `{ success, data, message }`; CORS allowlist `http://localhost:3000`.

---

## 1. Scope Summary

A single-form web login that authenticates admin users against the existing `users` table, issues a short-lived JWT, persists the session in `localStorage`, and gates the Admin dashboard. This phase reuses the existing authentication endpoint pattern and introduces no new persistence, SSO, password recovery, or MFA.

---

## 2. Screens

### 2.1 `/` — Root
- **Type:** Server-side redirect.
- **Behavior:** Always responds with a 307/308 redirect to `/login`. No UI rendered.
- **Auth:** N/A (redirect runs before auth check).

### 2.2 `/login` — Login Page (public)
- **Type:** Client component (`"use client"`).
- **Purpose:** Collect email + password, submit to backend, handle success/error feedback.
- **Layout (single column, centered card on desktop):**
  1. Page title: "Sign in to Admin Panel"
  2. Short subtitle (optional): "Use your admin credentials."
  3. Login form (see fields below).
  4. Inline form-level error banner (conditionally rendered).
- **Form fields:**

  | Field | Input type | Required | Attributes | Label |
  |---|---|---|---|---|
  | Email | `email` | yes | `autocomplete="email"`, `inputmode="email"`, `autofocus` on mount | "Email" |
  | Password | `password` | yes | `autocomplete="current-password"`, value never rendered in plaintext by default | "Password" |
  | Submit | `button[type="submit"]` | — | Disabled while pending; shows spinner / "Signing in…" label | "Sign in" |

- **States the page must render:**
  - `idle` — default.
  - `validating` — inline field errors shown beneath the offending input.
  - `pending` — submit disabled, spinner visible, inputs remain visible but read-only.
  - `error-credentials` — form-level banner: "Invalid email or password." (generic; no field attribution).
  - `error-network` — form-level banner: "We couldn't reach the server. Please try again."
  - `error-validation-server` — field-level message(s) returned by 422 mapped to the matching field.
- **Already-signed-in behavior:** On mount, if a non-expired `token` + `user` exist in `localStorage`, immediately redirect to `/dashboard` without rendering the form.

### 2.3 `/dashboard` — Dashboard (auth-guarded)
- **Type:** Client component.
- **Layout:**
  1. Header: "Admin Panel".
  2. Welcome line: "Welcome, {user.email}".
  3. "Log out" button (right-aligned or in header).
- **Guard:** On mount (`useEffect`), read `token` + `user` from `localStorage`. If either missing, redirect to `/login`. If present but token is clearly malformed, clear storage and redirect to `/login`.
- **Logout action:** Remove `token` and `user` from `localStorage`, then redirect to `/login`.

---

## 3. User Flows

### 3.1 Happy-path login
1. User visits `/` → redirected to `/login`.
2. Enters valid email + password → clicks "Sign in".
3. Client validates fields pass → enters `pending` state.
4. `POST /api/auth/login` → 200 with `success: true, data: { token, user }`.
5. Client stores `token` and `user` JSON in `localStorage`.
6. Client navigates to `/dashboard`.
7. Dashboard guard passes; welcome message and logout are rendered.

### 3.2 Invalid credentials
1. User submits a syntactically valid form with a wrong password (or unknown email).
2. Backend returns 401 with `success: false, data: null, message: "Invalid email or password"`.
3. Client shows the generic credential error banner. Fields retain values except password (cleared for safety). Focus returns to the email field.

### 3.3 Empty / malformed field validation (client-side, no network call)
1. User submits with email empty, malformed, or password shorter than 8 characters.
2. Client blocks submission, displays per-field messages (see Validation Rules §5).
3. Focus moves to the first invalid field. `aria-invalid="true"` and `aria-describedby` point at the error element.

### 3.4 Server-side validation fallback (defense in depth)
1. Client-side checks are bypassed or a new rule is introduced server-side.
2. Backend returns 422 with `success: false, data: null, message: "Validation failed"` and a field-keyed error map (see §4.3).
3. Client renders each field error beneath the matching input.

### 3.5 Already-signed-in user visits `/login`
1. User with a valid `token` + `user` in `localStorage` navigates to `/login`.
2. Before rendering the form, client sees stored credentials and redirects to `/dashboard`.

### 3.6 Unauthenticated user visits `/dashboard`
1. Visitor has no `token`/`user` in `localStorage`.
2. Dashboard guard immediately redirects to `/login`.
3. No protected content is flashed (render form only after the guard resolves the check).

### 3.7 Logout
1. User clicks "Log out" on `/dashboard`.
2. Client removes `token` and `user` from `localStorage`.
3. Client navigates to `/login`.
4. Visiting `/dashboard` afterwards redirects to `/login` per 3.6.

### 3.8 Backend unreachable
1. User submits valid form; `fetch()` throws or returns a non-2xx/401/422 response.
2. Client shows the generic "couldn't reach the server" banner, leaves the form populated, exits `pending` state.
3. No diagnostic or stack info is shown to the user.

---

## 4. API Surface

### 4.1 Endpoint
`POST http://localhost:8000/api/auth/login`

- **Request headers:** `Content-Type: application/json`
- **Auth:** none (public endpoint).
- **CORS:** Only `http://localhost:3000` is allowed (preserves existing CORS policy).

### 4.2 Request body
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

### 4.3 Responses (always return the envelope `{ success, data, message }`)

**200 OK — success**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "c1a0...",
      "email": "admin@example.com"
    }
  },
  "message": "Login successful"
}
```

- `token`: JWT signed with HS256, payload includes `sub` (user id), `email`, `exp` (now + 60 min).
- `user`: never includes `password_hash` or any sensitive column.

**401 Unauthorized — invalid credentials**
```json
{
  "success": false,
  "data": null,
  "message": "Invalid email or password"
}
```

The same 401 body is returned whether the email is unknown or the password is wrong — never disclose which.

**422 Unprocessable Entity — validation failure**
```json
{
  "success": false,
  "data": {
    "errors": {
      "email": "Email is required",
      "password": "Password must be at least 8 characters"
    }
  },
  "message": "Validation failed"
}
```

Only fields that failed are present in `errors`. Messages are safe to surface to end users.

**500 / network-level errors**
- Backend should avoid 500s on the happy path. If an unexpected error occurs, return:
```json
{ "success": false, "data": null, "message": "Internal server error" }
```
Client treats any non-200/401/422 response (or fetch rejection) as a transport/backend-unreachable condition.

### 4.4 Backend flow (informative, non-prescriptive)
1. Parse and validate body (Pydantic model or equivalent).
2. Normalize email (`trim`, `lower`).
3. Look up user by email from the `users` table.
4. If user missing OR bcrypt check fails → 401 with generic message.
5. Build JWT with `sub`, `email`, `exp` (now + 60 min) using existing secret.
6. Return success envelope with `token` and minimal `user` DTO.

---

## 5. Validation Rules

### 5.1 Email
- **Required.** Empty string / whitespace-only → "Email is required".
- **Format.** RFC-lite pattern acceptable (e.g. `^[^\s@]+@[^\s@]+\.[^\s@]+$`). Non-matching → "Enter a valid email address".
- **Max length:** 254 characters. Over → "Email is too long".
- **Normalization:** trimmed and lowercased before transport and comparison.

### 5.2 Password
- **Required.** Empty → "Password is required".
- **Min length:** 8 characters (admin seed `password123` satisfies). Under → "Password must be at least 8 characters".
- **Max length:** 128 characters. Over → "Password is too long".
- **Never logged**, never echoed back to the client, never included in success responses.

### 5.3 Enforcement
- **Client:** Runs before submit; blocks network call on failure.
- **Server:** Runs defensively on every request; failures return 422 with field-keyed messages (§4.3).

### 5.4 Error attribution
- **Bad credentials:** always 401 with a single generic message; never indicates which field was wrong.
- **Validation:** 422 messages are field-scoped and safe to display verbatim.

---

## 6. Data Entities

Reuse the existing `users` table from `core/seed.py` — no new tables required for this iteration. (The data-modeler owns the DDL; this spec only describes the logical shape the auth flow relies on.)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Returned to client as part of `user` DTO. |
| `email` | text, unique | Normalized lowercase. Used as login identifier. |
| `password_hash` | text | bcrypt hash; never leaves the server. |
| `created_at` | timestamp | Existing. |
| `updated_at` | timestamp | Existing. |

**DTO returned to client** (subset only): `{ id, email }`. No hash, no timestamps.

---

## 7. Acceptance Criteria (testable)

Written given/when/then so qa-tester can lift them into Playwright specs.

**AC-1 — Render login form**
- **Given** the user visits `/login` while signed out
- **When** the page loads
- **Then** an email input, a password input (masked), and a "Sign in" button are visible, focus is on the email input.

**AC-2 — Root redirects to login**
- **Given** the user opens `/`
- **Then** the browser lands on `/login` (via server-side redirect).

**AC-3 — Successful login**
- **Given** the admin user submits `admin@example.com` / `password123`
- **When** the backend returns 200
- **Then** `token` and `user` are present in `localStorage` and the user lands on `/dashboard` showing their email.

**AC-4 — Invalid credentials**
- **Given** the user submits an unknown email or wrong password
- **When** the backend returns 401
- **Then** a generic "Invalid email or password" message is shown, no token is stored, the user stays on `/login`, and the password field is cleared.

**AC-5 — Client-side validation blocks submit**
- **Given** the user submits with an empty email or a password shorter than 8 characters
- **Then** no network request is made, inline field errors appear, and focus moves to the first invalid field.

**AC-6 — Server-side validation surfaced**
- **Given** a 422 response with `errors.email` and/or `errors.password`
- **Then** those messages are rendered beneath their respective fields.

**AC-7 — Unauthenticated visit to `/dashboard` redirects**
- **Given** `localStorage` has no `token` / `user`
- **When** the user opens `/dashboard`
- **Then** they are redirected to `/login` without protected content flashing.

**AC-8 — Signed-in user visiting `/login` is bounced to dashboard**
- **Given** valid `token` and `user` exist in `localStorage`
- **When** the user opens `/login`
- **Then** they are redirected to `/dashboard` without seeing the form.

**AC-9 — Logout clears session**
- **Given** the user is on `/dashboard`
- **When** they click "Log out"
- **Then** `token` and `user` are removed from `localStorage` and the user is on `/login`; revisiting `/dashboard` redirects back to `/login`.

**AC-10 — Pending state**
- **Given** the user submits a valid form
- **Then** the submit button is disabled with a pending indicator until the response resolves.

**AC-11 — Backend unreachable**
- **Given** the backend is offline or returns a non-standard response
- **Then** a generic "We couldn't reach the server. Please try again." message is shown; no stack trace or technical detail is surfaced.

**AC-12 — No plaintext password disclosure**
- **Given** any login attempt
- **Then** the password is never rendered in plaintext in the DOM by default, never written to `localStorage`, and never included in any response payload.

---

## 8. Non-Functional Requirements

### 8.1 Security (baseline)
- Passwords stored as bcrypt hashes (existing behavior — unchanged).
- JWT signed with HS256 using existing server secret; expiry **60 minutes** from issuance.
- Credential error messages must be identical for unknown-email vs wrong-password.
- Server must not log request bodies of `/api/auth/login` nor include passwords in any log line.
- Response bodies must never include `password_hash`.
- Transport: current development runs unencrypted on localhost; production deployments must front the API with TLS (tracked as an environment concern, not a code change in this phase).

### 8.2 Accessibility (baseline, WCAG 2.1 AA oriented)
- Every input has an associated `<label>` (not placeholder-only).
- Entire form is reachable and submittable via keyboard (Tab order: email → password → submit).
- Error messages use `role="alert"` or `aria-live="polite"` and are tied to their input via `aria-describedby`.
- Invalid inputs get `aria-invalid="true"` and a non-color cue (icon + text), not color alone.
- Focus indicators remain visible on all interactive elements; contrast meets AA.

### 8.3 Usability / Performance
- Page must render and be interactive quickly on modern desktop browsers (Chromium, Firefox, Safari latest).
- Submit button must enter a `pending` visual state within 100 ms of click.
- Redirects after login and logout must be immediate (no interstitials).

### 8.4 Reliability / Error handling
- Any fetch rejection or non-handled status code → generic "please try again" banner.
- Client never logs credentials to the console.

### 8.5 Observability
- Backend may log non-sensitive auth events (e.g. "login failed for <email-hash-or-email-only-if-policy-permits>") at INFO level — but MUST NOT log passwords or full tokens.

---

## 9. Out of Scope (copied from PROTOTYPE §4 — do not expand)

- Self-service registration / account creation.
- Password reset / forgot-password flow.
- Single Sign-On (SSO), OAuth, or social login.
- Multi-factor authentication (MFA) / OTP / passkeys.
- "Remember me" persistent session or device trust.
- Account lockout, CAPTCHA, or rate-limit UI.
- Role-based authorization UI (authentication only; authorization UI is a later phase).
- Internationalization / multi-language copy.

---

## 10. Open Questions (forwarded from PROTOTYPE §8)

1. Confirm the 60-minute JWT expiry is acceptable for admin working patterns, or specify a different duration.
2. Confirm no branding/visual guidelines are required beyond the current Admin Panel look (affects ui-designer).
3. Confirm "forgot password" can truly be deferred — is there a manual recovery process available to admins in the meantime?

If any of these change the answers below, update this spec before downstream agents start work:
- **Session duration** currently set to **60 minutes** (existing backend default).
- **Visual style** currently assumed to match existing Tailwind v4 Admin Panel defaults.
- **Recovery** currently assumed to be manual/DBA-driven and out of scope for this phase.

---

## 11. Downstream Handoff Checklist

- **data-modeler:** confirm the existing `users` schema satisfies §6; no new DDL expected.
- **backend-developer:** implement/keep `POST /api/auth/login` per §4 and §5.3; ensure envelope and status-code contracts.
- **ui-designer:** produce the `/login` and `/dashboard` screens per §2 and §8.2.
- **frontend-developer:** wire the form to §4; respect state machine in §2.2; implement guards in §2.3 and flows in §3.
- **qa-tester:** derive Playwright/Jest tests from §7 (acceptance criteria).
