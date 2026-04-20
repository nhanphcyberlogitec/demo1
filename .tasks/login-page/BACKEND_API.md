# Login Page — Backend API Contract (BACKEND_API.md)

> Consumer: the `frontend-developer` agent implementing `admin/app/login/page.tsx` and related auth guard / logout flows.
> Authority: derived from `PROTOTYPE.md` and `TECH_SPEC.md` (§5, §6, §7). Any divergence between this file and `TECH_SPEC.md` is a bug in this file.

---

## 1. Base

| Item | Value |
|------|-------|
| Base URL (dev) | `http://localhost:8000` |
| Content type | `application/json; charset=utf-8` |
| Auth scheme (for protected endpoints) | `Authorization: Bearer <jwt>` |
| CORS origin allow-listed | `http://localhost:3000` |
| CORS methods allowed | `GET, POST, OPTIONS` |
| CORS headers allowed | `Authorization, Content-Type` |

---

## 2. Response Envelope

Every endpoint — success or failure — returns the same JSON envelope:

```json
{
  "success": true | false,
  "data":    <object | null>,
  "message": "<string>"
}
```

Discipline:

- `success: true` ⇔ HTTP 2xx. `data` is an object.
- `success: false` ⇔ HTTP 4xx or 5xx. `data` is `null`.
- `message` is **always** a string — never `null`. Empty string is allowed on success when there is nothing to say.
- `message` values surfaced to the user are user-safe sentences (no stack traces, no raw DB errors).

---

## 3. Endpoints

### 3.1 `POST /api/auth/login`

Verify credentials and issue a JWT.

**Auth:** none.

**Request headers**
```
Content-Type: application/json
```

**Request body**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Field constraints (enforced server-side by Pydantic)**

| Field | Type | Rule |
|-------|------|------|
| `email` | string | Required, non-empty, valid email format (`EmailStr`). |
| `password` | string | Required, non-empty, min length 6. |

Email is compared case-insensitively (server lower-cases before lookup). Passwords are never logged.

**Success — `200 OK`**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "5f9d7c4a-2b1e-4c3d-9e8f-1a2b3c4d5e6f",
      "email": "admin@example.com",
      "full_name": "Admin User"
    }
  },
  "message": "Login successful."
}
```

- `token`: raw JWT string. Store verbatim (do not decode or re-serialize).
- `user.id`: UUID as string.
- `user.full_name`: may be `null` if the seeded user has no name; render a sensible fallback (e.g. the email) in that case.

**Failure responses**

| HTTP | `success` | `data` | `message` | When |
|------|-----------|--------|-----------|------|
| `401 Unauthorized` | `false` | `null` | `"Invalid email or password."` | Email not found **or** password hash mismatch. Indistinguishable by design (see §4.2). |
| `422 Unprocessable Entity` | `false` | `null` | `"Invalid request."` | Request fails Pydantic validation: missing field, malformed JSON, non-email email, password shorter than 6 chars. |
| `500 Internal Server Error` | `false` | `null` | `"Something went wrong. Please try again."` | Unexpected server error. Details logged server-side, not returned. |

Network-level failures (fetch rejection, non-JSON response body) are the frontend's problem to surface — the backend never produces those.

### 3.2 `GET /api/auth/me`

Validate the stored token and return the authenticated user. Frontend may call this on app load to confirm a stored token is still valid rather than trusting `localStorage.user` blindly.

**Auth:** required.

**Request headers**
```
Authorization: Bearer <jwt>
```

**Success — `200 OK`**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "5f9d7c4a-2b1e-4c3d-9e8f-1a2b3c4d5e6f",
      "email": "admin@example.com",
      "full_name": "Admin User"
    }
  },
  "message": ""
}
```

**Failure responses**

| HTTP | `success` | `data` | `message` | When |
|------|-----------|--------|-----------|------|
| `401 Unauthorized` | `false` | `null` | `"Session expired. Please sign in again."` | Missing / malformed / expired token, or token references a user that no longer exists. |
| `500 Internal Server Error` | `false` | `null` | `"Something went wrong. Please try again."` | Unexpected server error. |

Frontend behaviour on 401 from `/me` (or any future protected endpoint): clear `localStorage.token` + `localStorage.user`, redirect to `/login`.

---

## 4. JWT Details

### 4.1 Claims

```json
{
  "sub":   "<user.id>",
  "email": "<user.email>",
  "iat":   <unix_timestamp_now>,
  "exp":   <unix_timestamp_now_plus_3600>
}
```

- Algorithm: `HS256`.
- Secret: server-side `SECRET_KEY` constant. Never transmitted.
- TTL: **60 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES = 60`). No refresh token in v1.
- The frontend does **not** need to parse or verify the JWT. Treat it as an opaque bearer string.

### 4.2 Error-message parity (security)

`401 Invalid email or password.` is returned for **both** "email not found" and "password mismatch". The frontend must not try to distinguish these cases (it can't from the response alone, and shouldn't). Render the `message` verbatim.

---

## 5. Frontend Integration Recipe

### 5.1 Login request

```ts
const res = await fetch("http://localhost:8000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

let body: { success: boolean; data: any; message: string };
try {
  body = await res.json();
} catch {
  // Non-JSON response → treat as network failure.
  showError("We couldn't reach the server. Please try again.");
  return;
}

if (res.ok && body.success) {
  localStorage.setItem("token", body.data.token);
  localStorage.setItem("user", JSON.stringify(body.data.user));
  router.replace("/dashboard");
  return;
}

// 401 / 422 / 500 — envelope is still present.
showError(body.message || "Something went wrong. Please try again.");
```

For `fetch` rejection (network error), show: `"We couldn't reach the server. Please try again."` and clear the password field.

### 5.2 Authenticated request template

```ts
const token = localStorage.getItem("token");
const res = await fetch("http://localhost:8000/api/auth/me", {
  headers: { Authorization: `Bearer ${token}` },
});
if (res.status === 401) {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  router.replace("/login");
  return;
}
```

### 5.3 Logout

No backend call. Client-side only:

```ts
localStorage.removeItem("token");
localStorage.removeItem("user");
router.replace("/login");
```

---

## 6. Validation Reference (mirrors frontend rules)

Client must mirror these, but the server is authoritative. If the server rejects a payload the client considered valid, show `"Invalid request."` (the server's message) and allow retry.

| Field | Rule | 422 trigger? |
|-------|------|--------------|
| `email` missing | Required | Yes |
| `email` empty string | Required | Yes |
| `email` not an email | Valid email format | Yes |
| `password` missing | Required | Yes |
| `password` shorter than 6 chars | Min length 6 | Yes |

---

## 7. Non-Functional Notes

- **Latency:** p95 login round-trip under 1s in dev. If slower, check the bcrypt work factor.
- **Logging:** each login attempt logs `{ timestamp, email (lower-cased), outcome }` where outcome ∈ `success | invalid_credentials | validation_error | server_error`. **Never** logs the password or the issued JWT.
- **CORS:** preflight `OPTIONS` requests from `http://localhost:3000` to `/api/auth/*` must succeed. Backend middleware handles this — frontend does not need to set any extra header beyond `Content-Type` (on `POST`) and `Authorization` (on authenticated `GET`s).
- **HTTPS:** assumed in production; out of scope here. Dev runs over plain HTTP on localhost.

---

## 8. Out of Scope for This Contract

Per `PROTOTYPE.md §4.2` and `TECH_SPEC.md §10`:

- No `POST /api/auth/logout` (v1 JWT is stateless).
- No `POST /api/auth/register` (users are provisioned via `core/seed.py`).
- No `POST /api/auth/forgot-password` or `/reset-password`.
- No social / MFA / refresh-token endpoints.
- No rate-limit headers defined; brute-force protection is deferred.

New endpoints beyond the two above require a new spec revision.

---

## 9. Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial contract derived from `TECH_SPEC.md` §5–§7. |
