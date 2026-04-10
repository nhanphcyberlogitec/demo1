# PROTOTYPE.md — Simple Login Page

> **Version:** 1.0
> **Date:** 2026-04-10
> **Status:** Draft — pending user review

---

## 1. Overview

A simple login page for the Admin Panel. Users enter email and password, the backend validates credentials against the PostgreSQL `users` table using bcrypt, and returns a JWT token on success. The frontend stores the token in localStorage and redirects to `/dashboard`.

---

## 2. UI Design

### 2.1 Login Page (`/login`)

**Layout:** Centered card on a neutral background, full viewport height.

| Property | Value |
|----------|-------|
| Background | `#F9FAFB` (`bg-gray-50`) |
| Layout | Flex column, centered horizontally and vertically |
| Min height | `100vh` |

### 2.2 Login Card

| Property | Value |
|----------|-------|
| Width | `400px` max, full-width on mobile with `px-4` padding |
| Padding | `32px` (`p-8`) |
| Background | `#FFFFFF` (`bg-white`) |
| Border radius | `8px` (`rounded-lg`) |
| Shadow | `shadow-sm` |

### 2.3 Components (top to bottom)

| # | Element | Details |
|---|---------|---------|
| 1 | Heading | `<h1>` "Login", `text-2xl font-bold text-gray-900`, centered |
| 2 | Email label | `<label>` "Email", `text-sm font-medium text-gray-700` |
| 3 | Email input | `<input type="email">`, placeholder "admin@example.com", required, full width, `border-gray-300 rounded-md px-3 py-2.5` |
| 4 | Password label | `<label>` "Password", same style as email label |
| 5 | Password input | `<input type="password">`, placeholder "Enter password", required, full width, same style |
| 6 | Error message | `<p>` conditional, `text-sm text-red-600`, shown between password and button |
| 7 | Submit button | `<button>` "Login", full width, `bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md py-2.5` |

### 2.4 Interactive States

| State | Behavior |
|-------|----------|
| Default | Fields empty, button enabled, no error shown |
| Focus | Blue border + ring on focused input |
| Loading | Button text "Logging in...", disabled with reduced opacity |
| Error | Red error text appears above button |
| Success | Store token + user in localStorage, redirect to `/dashboard` |

### 2.5 Responsive

- Desktop (>= 640px): Card at 400px width, centered
- Mobile (< 640px): Card full-width with horizontal padding

---

## 3. Database Schema

### Table: `users` (already exists via `core/seed.py`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PRIMARY KEY, DEFAULT `gen_random_uuid()` |
| `name` | `VARCHAR(255)` | NOT NULL |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL |
| `password_hash` | `VARCHAR(255)` | NOT NULL |
| `created_at` | `TIMESTAMP` | DEFAULT `NOW()` |
| `updated_at` | `TIMESTAMP` | DEFAULT `NOW()` |

**No schema changes needed.** Existing table supports the login flow.

### Seed Data

| name | email | password (plaintext) |
|------|-------|---------------------|
| Admin | `admin@example.com` | `password123` |

---

## 4. Backend API

### `POST /api/auth/login`

**Must be implemented in `core/main.py`.** The endpoint does not currently exist — `main.py` only has placeholder routes.

**Request body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Validation:**
- `email` must be valid email format -> return `422` if invalid
- `password` must be >= 6 characters -> return `422` if too short

**Logic:**
1. Query `users` table by email
2. If not found -> return `401`
3. Verify password with `bcrypt.checkpw()` -> return `401` if mismatch
4. Generate JWT token (HS256, 60 min expiry) with payload `{ sub: user_id, email }`
5. Return `200` with token and user object

**Success response (`200`):**

```json
{
  "success": true,
  "data": {
    "token": "jwt-string",
    "user": { "id": "uuid", "name": "string", "email": "string" }
  },
  "message": ""
}
```

**Error responses:**

- `401`: `{ "success": false, "data": null, "message": "Invalid email or password" }`
- `422`: `{ "success": false, "data": null, "message": "Invalid email format" }` or `"Password must be at least 6 characters"`

**Dependencies:** python-jose, bcrypt, psycopg2

**CORS:** Allow `http://localhost:3000`

**JWT Config:**

| Setting | Value |
|---------|-------|
| Secret | `super-secret-key-change-in-production` |
| Algorithm | HS256 |
| Expiration | 60 minutes |

---

## 5. Frontend Logic

### File: `admin/app/login/page.tsx`

Client component (`"use client"`).

**State:**

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `email` | `string` | `""` | Controlled email input |
| `password` | `string` | `""` | Controlled password input |
| `error` | `string` | `""` | Error message display |
| `loading` | `boolean` | `false` | Loading state for button |

**Flow:**
1. User fills form and clicks "Login"
2. POST to `http://localhost:8000/api/auth/login` with `{ email, password }`
3. On success: `localStorage.setItem("token", ...)`, `localStorage.setItem("user", JSON.stringify(...))`, redirect to `/dashboard`
4. On failure: display API `message` as error
5. On network error: display "Unable to connect to server. Please try again."

### File: `admin/app/dashboard/page.tsx`

**Auth guard:** Check localStorage for `token` and `user` on mount. If missing, redirect to `/login`.

**Content:** Welcome message with user name, "Logout" button that clears localStorage and redirects to `/login`.

### Root Page (`/`)

Redirect to `/login`.

---

## 6. Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Valid login (`admin@example.com` / `password123`) | 200, redirect to `/dashboard` |
| 2 | Wrong password | 401, "Invalid email or password" |
| 3 | Non-existent email | 401, "Invalid email or password" |
| 4 | Invalid email format | 422, validation error |
| 5 | Password too short (< 6 chars) | 422, validation error |
| 6 | Empty fields | Blocked by HTML5 `required` |
| 7 | Server unreachable | "Unable to connect to server" |

---

## 7. File Map

| File | Purpose |
|------|---------|
| `admin/app/login/page.tsx` | Login page (to create) |
| `admin/app/dashboard/page.tsx` | Dashboard with auth guard (to create) |
| `admin/app/page.tsx` | Root redirect to `/login` (to update) |
| `core/main.py` | Login endpoint + CORS + JWT (to implement) |
| `core/database.py` | PostgreSQL connection (exists) |
| `core/seed.py` | Users table + seed data (exists) |
