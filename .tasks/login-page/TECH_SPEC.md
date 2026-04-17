# TECH_SPEC.md — Simple Login Page

**Version:** 1.0
**Date:** 2026-04-14
**Author:** Technical Writer Agent
**Source:** `PROTOTYPE.md` v1.0 (approved 2026-04-14)
**Status:** Draft — pending user review

---

## 1. Purpose

This Functional/Technical Specification translates the approved business
requirements in `PROTOTYPE.md` into a concrete, build-ready description of the
Admin Panel **Simple Login Page**. It is the input for the data modeler, the
backend developer, and the UI designer.

It covers:

1. Screens and layout
2. User flows
3. Data entities
4. API surface
5. Validation rules
6. Acceptance criteria

No source code is prescribed here; implementation details (framework idioms,
file paths) are intentionally left to the respective implementers.

## 2. Screens

### 2.1 Screen Inventory

| ID   | Screen            | Route        | Access         | Purpose                                        |
|------|-------------------|--------------|----------------|------------------------------------------------|
| S-1  | Login Page        | `/login`     | Public         | Authenticate an administrator.                 |
| S-2  | Dashboard (ref.)  | `/dashboard` | Authenticated  | Post-login landing page (referenced only).     |
| S-3  | Root redirect     | `/`          | Public         | Server-side redirect to `/login`.              |

Only **S-1** is in scope for this spec. S-2 and S-3 are referenced as
destinations / sources of navigation.

### 2.2 S-1 — Login Page Layout

The page SHALL be a single centered card on a neutral background, containing:

1. **Brand header** — text "Admin Panel" (logo asset optional, see §9).
2. **Form**
   - **Email** input
     - Label: "Email"
     - Placeholder: `you@example.com`
     - Type: `email`
     - Autocomplete: `username`
   - **Password** input
     - Label: "Password"
     - Placeholder: empty
     - Type: `password` (masked by default)
     - Autocomplete: `current-password`
   - **Sign In** button
     - Primary style, full width of the form
     - Default label: "Sign In"
     - Loading label: "Signing in…" (disabled, with spinner/indicator)
3. **Inline validation messages** shown directly beneath the offending field.
4. **Form-level error banner** shown above the form for authentication
   failures or unexpected errors.

The layout SHALL be responsive down to 360 px width and render correctly on
the latest two versions of Chrome, Firefox, Safari, and Edge on desktop.

### 2.3 Visual/Interaction States

Each field SHALL support these states:

- **Default** — neutral border.
- **Focused** — highlighted border, visible focus ring (keyboard-accessible).
- **Error** — red border, red helper text below field.
- **Disabled** — used while the form is submitting.

The Sign In button SHALL support **Default**, **Hover**, **Focused**,
**Disabled**, and **Loading** states.

## 3. User Flows

### 3.1 Flow A — Successful Login

1. Unauthenticated user navigates to `/login`.
2. User types a valid email and password.
3. User clicks **Sign In** (or presses Enter while a form field is focused).
4. Frontend disables the form and shows the button loading state.
5. Frontend calls `POST /api/auth/login`.
6. Backend returns `200` with `success: true`, a JWT, and a user object.
7. Frontend persists the token and user in `localStorage`
   (keys: `token`, `user`).
8. Frontend redirects to `/dashboard`.

### 3.2 Flow B — Failed Login (Bad Credentials)

1. Steps 1–5 as in Flow A.
2. Backend returns `401` with `success: false`,
   `message: "Invalid email or password"`, `data: null`.
3. Frontend re-enables the form, clears the Password field, keeps the Email
   field populated, and shows the form-level error banner with the returned
   message.
4. The Email field retains its value; focus moves to the Password field.

### 3.3 Flow C — Client-side Validation Failure

1. User submits the form with an empty or malformed field.
2. Frontend does **not** call the API.
3. Inline messages appear under each invalid field.
4. Focus moves to the first invalid field.

### 3.4 Flow D — Server-side Validation Failure

1. Frontend calls `POST /api/auth/login` with a payload that fails backend
   validation (e.g. email not formatted, password shorter than 6 chars).
2. Backend returns `422` with `success: false` and a descriptive `message`.
3. Frontend surfaces the message in the form-level error banner.

### 3.5 Flow E — Already-Authenticated User

1. User with a valid `token` in `localStorage` navigates to `/login`.
2. Frontend detects the token in a client-side effect and redirects to
   `/dashboard` without rendering the form.
3. (Note: token validity is not cryptographically verified on the client; an
   expired token will be rejected on the next protected API call.)

### 3.6 Flow F — Network / Unexpected Error

1. `POST /api/auth/login` fails to reach the backend, times out, or returns
   an unexpected status.
2. Frontend re-enables the form and shows a generic message:
   "Something went wrong. Please try again."

## 4. Data Entities

Only one entity is in scope for this version.

### 4.1 `users`

| Column          | Type           | Constraints                              | Notes                               |
|-----------------|----------------|------------------------------------------|-------------------------------------|
| `id`            | `uuid`         | PK, default `gen_random_uuid()`          | Stable identifier.                  |
| `email`         | `varchar(255)` | `NOT NULL`, `UNIQUE`, lowercased         | Used as login identifier.           |
| `password_hash` | `varchar(255)` | `NOT NULL`                               | bcrypt hash; plaintext never stored.|
| `is_active`     | `boolean`      | `NOT NULL`, default `TRUE`               | Reserved; inactive users are rejected.|
| `created_at`    | `timestamptz`  | `NOT NULL`, default `NOW()`              |                                     |
| `updated_at`    | `timestamptz`  | `NOT NULL`, default `NOW()`              | Updated on every row change.        |

Index: `UNIQUE (email)`.

### 4.2 Derived / In-Memory Entities

- **Session token (JWT)** — signed with HS256; payload includes `sub`
  (user id), `email`, and `exp` (60 minutes from issue).
- **LocalStorage records (frontend only)**
  - `token`: raw JWT string.
  - `user`: JSON string of `{ id, email }`.

## 5. API Surface

### 5.1 Envelope

All endpoints return the standard envelope:

```json
{ "success": true | false, "data": object | null, "message": "string" }
```

### 5.2 `POST /api/auth/login`

Authenticates a user and issues a session token.

- **Auth required:** No
- **Content-Type:** `application/json`

**Request body**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Responses**

`200 OK` — success

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": "<uuid>", "email": "admin@example.com" }
  },
  "message": "Login successful"
}
```

`401 Unauthorized` — bad credentials

```json
{
  "success": false,
  "data": null,
  "message": "Invalid email or password"
}
```

`422 Unprocessable Entity` — validation failure

```json
{
  "success": false,
  "data": null,
  "message": "Email must be a valid email address"
}
```

**Behavior**

- The backend SHALL lookup by `LOWER(email)`.
- The backend SHALL compare the submitted password to `password_hash` using
  bcrypt.
- On success, the backend SHALL issue a JWT with a 60-minute expiry.
- On failure, the backend SHALL return the identical `401` message
  regardless of whether the email exists or the password is wrong.
- `is_active = false` users SHALL be treated as a failed login and return
  the same generic `401`.

### 5.3 Out-of-scope endpoints (explicitly deferred)

- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/refresh`
- `GET  /api/auth/me`

They are listed here so downstream agents do not plan for them in this
iteration.

## 6. Validation Rules

### 6.1 Client-side (frontend)

| Field    | Rule                                                              | Message                                   |
|----------|-------------------------------------------------------------------|-------------------------------------------|
| Email    | Required                                                          | "Email is required."                      |
| Email    | Must match a basic email pattern (`^[^\s@]+@[^\s@]+\.[^\s@]+$`)   | "Enter a valid email address."            |
| Password | Required                                                          | "Password is required."                   |
| Password | Minimum 6 characters                                              | "Password must be at least 6 characters." |

Validation SHALL run:

- On **submit** (blocks the request when any rule fails).
- On **blur** of each field after the user has interacted with it.

### 6.2 Server-side (backend)

The backend SHALL re-validate every constraint and SHALL NOT trust the
frontend. Validation failures return `422` with an actionable `message`.

### 6.3 Generic Error Policy

The backend SHALL NOT disclose which part of the credential pair is
incorrect. The frontend SHALL NOT attempt to infer it either.

## 7. Security Requirements

- Passwords are stored only as bcrypt hashes; plaintext is never persisted
  or logged.
- The JWT secret is a backend-side configuration value; it SHALL NOT appear
  in any frontend artifact.
- All login traffic MUST run over HTTPS in any non-local environment.
- The backend SHALL set `Cache-Control: no-store` on the login response.
- CORS: the backend allows only `http://localhost:3000` for local
  development; production origins SHALL be configured per environment.

## 8. Accessibility Requirements

- Every form control has a visible, programmatically associated `<label>`.
- Tab order: Email → Password → Sign In.
- Pressing **Enter** while focus is within the form submits it.
- Error messages are associated with their field via `aria-describedby` and
  the field carries `aria-invalid="true"` when in the error state.
- Color is not the sole signal of error state (icon or text also used).
- Focus ring is visible at all times for keyboard users.

## 9. Open Items (carried forward from PROTOTYPE.md §8)

These remain unresolved. They do not block this spec but SHALL be answered
before the UI designer finalizes the mockups.

1. Show a non-functional "Forgot password?" link? *(Default assumption: no.)*
2. Include a company logo asset? *(Default assumption: text-only brand.)*
3. Remember the last-used email in the browser? *(Default assumption: no.)*
4. Include compliance/legal notices (e.g. Terms of Use)? *(Default
   assumption: no.)*

If no answers are provided, the "Default assumption" for each item applies.

## 10. Acceptance Criteria

A feature increment is considered complete when **all** of the following are
demonstrably true.

### 10.1 Functional

- **AC-1** Navigating to `/login` renders the Admin Panel login form with
  Email, Password, and Sign In controls, and the page title is
  "Admin Panel".
- **AC-2** Submitting the form with an empty Email shows
  "Email is required." inline under the Email field and does not call the
  API.
- **AC-3** Submitting the form with an empty Password shows
  "Password is required." inline under the Password field and does not call
  the API.
- **AC-4** Submitting with a malformed email (e.g. `foo@bar`) shows
  "Enter a valid email address."
- **AC-5** Submitting with a password shorter than 6 characters shows
  "Password must be at least 6 characters."
- **AC-6** Submitting valid credentials for the seeded admin
  (`admin@example.com` / `password123`) results in a `200` response,
  storage of `token` and `user` in `localStorage`, and redirect to
  `/dashboard`.
- **AC-7** Submitting an unknown email or a wrong password results in a
  `401` response and the page shows "Invalid email or password" without
  indicating which field was wrong.
- **AC-8** While the request is in flight, the Sign In button is disabled
  and its label reflects the loading state; fields are disabled.
- **AC-9** After a failed login, the Email field retains its value, the
  Password field is cleared, and focus moves to the Password field.
- **AC-10** Visiting `/login` with a `token` present in `localStorage`
  redirects to `/dashboard` without rendering the form.
- **AC-11** Visiting `/` redirects to `/login`.

### 10.2 Non-Functional

- **AC-12** From a cold page load, a valid user can complete login in under
  10 seconds on a typical desktop connection (per success criterion in
  `PROTOTYPE.md` §6).
- **AC-13** The full flow is operable with keyboard only (Tab, Shift+Tab,
  Enter).
- **AC-14** The password field masks input at all times.
- **AC-15** No plaintext password appears in network logs, application
  logs, or the database.
- **AC-16** The backend returns the standard envelope
  `{ success, data, message }` for every response, including errors.

### 10.3 Test Coverage (targets for QA)

- Backend `pytest` tests cover: happy path, unknown email, wrong password,
  malformed email, short password, inactive user, and envelope shape.
- Frontend Jest tests cover: each client-side validation rule, the loading
  state, the post-login redirect, and the already-authenticated redirect.
- Playwright E2E test covers Flow A end-to-end against a running backend
  and the seeded admin user.

---

**Next step:** Please review this document and confirm or request changes
before the data modeler, backend developer, and UI designer begin their
work.
