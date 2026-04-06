# ShipTrack Pro — Login Page Prototype

## Figma Design

**File:** ShipTrack Pro — Login Page  
**URL:** https://www.figma.com/design/Z6ordPprErx3b4OBCmf4hn  
**Page:** Login Page  
**Frame:** Login Page — Desktop (1440 × 900)

### Design Status

The Figma file was partially built. The following was completed before hitting the Figma MCP Starter plan tool-call limit:

- Desktop frame with dark navy background (`#0A1628`)
- Left panel (792 × 900) — maritime illustration side with:
  - Compass rose geometry (concentric rings + crosshairs)
  - Blue dot grid (top-left) and orange accent dot grid (bottom-right)
  - Anchor badge (orange circle) + anchor icon
  - Company name "ShipTrack Pro" (Inter Bold, 48px, white)
  - Tagline "Freight & Logistics Management Platform" (Inter Light, 18px, `#2E6DA4`)
  - Orange divider rule
  - 3 feature bullet points
- Right panel (648 × 900) — form side (frame created, login card in progress when limit hit)

**Blocker:** The Figma MCP tool call limit on the Starter plan was reached before the login card form elements could be placed. See Blockers section below.

> The Frontend agent can implement directly from this PROTOTYPE.md specification without waiting for Figma completion.

---

## Visual Design Specification

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| Navy Deep | `#0A1628` | Page background, input field backgrounds |
| Navy Mid | `#1A3A5C` | Left panel gradient end, borders |
| Navy Light | `#2E6DA4` | Accent strokes, tagline text, decorative elements |
| Form Background | `#0F1E35` | Right panel background |
| Card Background | `#14264A` | Login card surface |
| Orange Primary | `#E8761A` | CTA button, anchor badge, bullet dots, divider |
| Orange Light | `#F5A623` | Button hover state |
| Text White | `#FFFFFF` | Headings, body on dark |
| Text Muted | `#A0B9D2` | Labels, placeholders, feature text |
| Text Faint | `#3C5A7D` | Footer text, dividers |

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Company name | Inter | Bold | 48px |
| Card title "Welcome Back" | Inter | Bold | 26px |
| Tagline / subtitle | Inter | Light | 18px |
| Input labels | Inter | Medium | 13px |
| Input placeholder text | Inter | Regular | 14px |
| Button label "LOGIN" | Inter | Bold | 16px, 8% letter-spacing |
| Feature bullets | Inter | Regular | 14px |
| Footer | Inter | Regular | 12px |
| Forgot password link | Inter | Medium | 13px |

### Layout — Desktop (1440 × 900)

```
+-------------------------------+---------------------------+
|  LEFT PANEL (792px)           |  RIGHT PANEL (648px)      |
|  Maritime / Illustration      |  Login Form               |
|                               |                           |
|  [Anchor badge]               |   +--- Login Card ---+    |
|  ShipTrack Pro                |   | [Anchor] Welcome  |    |
|  Tagline --------             |   | Back              |    |
|                               |   | Sign in to...     |    |
|  [Compass rose geometry]      |   |                   |    |
|  [Dot grids]                  |   | Email Address     |    |
|                               |   | [_____________]   |    |
|  * Feature 1                  |   |                   |    |
|  * Feature 2                  |   | Password          |    |
|  * Feature 3                  |   | [__________ eye]  |    |
|                               |   |                   |    |
|                               |   | [x] Remember me   |    |
|                               |   | Forgot password?  |    |
|                               |   |                   |    |
|                               |   | [   LOGIN   ]     |    |
|                               |   | (c) 2026 ShipTrack|    |
|                               |   +-------------------+    |
+-------------------------------+---------------------------+
```

### Layout — Mobile (390 × 844)

Single-column layout. Left panel collapses to a top banner (390 × 180) showing only the anchor badge and company name. Login card occupies the full remaining height with 24px horizontal padding.

### Login Card Spec (440 × 560, corner radius 16, positioned at x=104 y=170 in right panel)

| Element | Position (x, y) | Size | Notes |
|---|---|---|---|
| Anchor badge | 196, 48 | 48 × 48 | Orange circle `#E8761A` |
| "Welcome Back" title | 100, 112 | 240 × 36 | Centered, Inter Bold 26px, white |
| Subtitle text | 60, 154 | 320 × 20 | Centered, muted `#A0B9D2` |
| Email label | 40, 200 | auto | "Email Address", Medium 13px |
| Email input field | 40, 220 | 360 × 48 | Border `#2E6DA4` 1px, radius 8, bg `#0A1628` |
| Password label | 40, 288 | auto | "Password", Medium 13px |
| Password input field | 40, 308 | 360 × 48 | Border `#2E6DA4` 1px, radius 8, eye icon right |
| Remember me checkbox | 40, 378 | 18 × 18 | Border `#2E6DA4`, radius 3 |
| Remember me label | 64, 378 | auto | "Remember me", Regular 13px, muted |
| Forgot password link | 270, 378 | auto | "Forgot password?", Orange `#E8761A`, Medium 13px |
| Login CTA button | 40, 420 | 360 × 52 | Fill `#E8761A`, radius 8, hover `#F5A623` |
| "LOGIN" button text | centered | auto | Inter Bold 16px, 8% letter-spacing, white |
| Footer text | 80, 510 | 280 × 18 | Centered, faint `#3C5A7D`, Regular 12px |

### Card Drop Shadow

`box-shadow: 0px 20px 60px rgba(0, 0, 0, 0.4)`

---

## User Stories

### US-001 — Standard Login
**As a** freight operator,  
**I want to** sign in with my email and password,  
**So that** I can access the ShipTrack Pro dashboard and manage shipments.

**Acceptance Criteria:**
- Email field accepts valid email format; shows inline error for invalid format
- Password field masks input by default; eye icon toggles visibility
- Submitting valid credentials redirects to the main dashboard
- Submitting invalid credentials shows an error message: "Invalid email or password"
- Login button shows a loading state while the request is in flight
- On success, a JWT token is stored (localStorage or sessionStorage depending on "Remember me")

### US-002 — Remember Me
**As a** returning user,  
**I want to** check "Remember me" before logging in,  
**So that** I remain logged in across browser sessions without re-entering credentials.

**Acceptance Criteria:**
- "Remember me" checkbox is unchecked by default
- When checked, the auth token is persisted in localStorage (30-day expiry)
- When unchecked, the token is stored only in sessionStorage (expires on tab close)

### US-003 — Forgot Password
**As a** user who has forgotten their password,  
**I want to** click "Forgot password?" and receive a reset email,  
**So that** I can regain access to my account.

**Acceptance Criteria:**
- Clicking "Forgot password?" navigates to `/auth/forgot-password`
- User enters their email address and submits
- System sends a password reset link to that address if the account exists
- A confirmation message is shown regardless of whether the email exists (security best practice)

### US-004 — Session Validation
**As a** logged-in user,  
**I want** my session to be validated on each page load,  
**So that** expired or invalidated tokens redirect me back to the login page.

**Acceptance Criteria:**
- On app load, `GET /api/auth/me` is called with the stored token
- If the response is 401, clear the stored token and redirect to `/login`
- If valid, hydrate the user context and proceed to the requested route

### US-005 — Logout
**As a** logged-in user,  
**I want to** log out securely,  
**So that** my session is terminated and no one else can access my account.

**Acceptance Criteria:**
- Clicking "Logout" calls `POST /api/auth/logout` with the Bearer token
- On success (or failure), the stored token is cleared from localStorage/sessionStorage
- User is redirected to `/login`

---

## API Contract

Base URL: `/api/auth`  
All protected endpoints require: `Authorization: Bearer <token>`

---

### POST /api/auth/login

Authenticate a user and return a session token.

**Request**

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "captain@shiptrackpro.com",
  "password": "s3cur3P@ssw0rd",
  "rememberMe": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's plaintext password (HTTPS only) |
| `rememberMe` | boolean | No | If true, issue a long-lived token (30 days); default false = 24 hours |

**Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_abc123",
      "email": "captain@shiptrackpro.com",
      "name": "Captain James",
      "role": "operator",
      "avatarUrl": null
    }
  }
}
```

**Response — 401 Unauthorized**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Response — 422 Unprocessable Entity**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format"
  }
}
```

**Response — 429 Too Many Requests**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many login attempts. Please try again in 15 minutes."
  }
}
```

---

### POST /api/auth/logout

Invalidate the current session token server-side.

**Request**

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

No request body required.

**Response — 200 OK**

```json
{
  "success": true
}
```

**Response — 401 Unauthorized**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication token"
  }
}
```

> Note: The client must clear the stored token regardless of the server response code. Never rely on the server to clean up client-side state.

---

### GET /api/auth/me

Return the currently authenticated user's profile. Used for session validation on page load.

**Request**

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "captain@shiptrackpro.com",
      "name": "Captain James",
      "role": "operator",
      "avatarUrl": null,
      "lastLoginAt": "2026-04-06T08:30:00Z"
    }
  }
}
```

**Response — 401 Unauthorized**

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again."
  }
}
```

---

## Blockers

| ID | Description | Status |
|---|---|---|
| B-001 | Figma MCP Starter plan tool-call limit reached mid-build. Login card form elements (inputs, button, checkbox) were not placed in Figma. Upgrade Figma plan or complete the right panel manually using the spec above. | Open |
| B-002 | GitHub MCP authentication not configured — unable to auto-create a GitHub issue for B-001. Manual issue creation required with label `blocker` and title prefix `[Publisher]`. | Open |

---

*Document authored by: Publisher agent — 2026-04-06*
