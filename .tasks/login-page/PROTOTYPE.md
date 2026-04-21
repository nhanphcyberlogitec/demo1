# Login Page — Business Requirements (PROTOTYPE)

**Task:** Deliver a simple web login page for the Admin Panel.
**Source requirement:** `.tasks/login-page/requirement.md` — "Develop new login page simple for web."

---

## 1. Business Goals

- Provide a minimal, reliable entry point so authorized users can access the Admin Panel.
- Establish a trusted authentication touchpoint that protects the admin area from unauthenticated access.
- Keep the experience simple — no onboarding friction, no optional flows, fast time-to-first-screen.
- Re-use existing authentication capabilities (users already exist in the system, JWT already issued) to avoid rework.

## 2. Stakeholders

| Stakeholder | Interest |
|---|---|
| Admin users | Need a fast, predictable way to sign in to the Admin Panel. |
| Product owner | Wants a working login delivered quickly with room to extend later. |
| Security / Ops | Needs assurance that credentials are handled safely and sessions are controlled. |
| Engineering team | Needs a clear, narrow scope that fits the existing Next.js + FastAPI stack. |

## 3. User Stories

- **US-1 — Sign in with email and password**
  As an admin user, I want to enter my email and password on the login page so that I can access the Admin Panel.
- **US-2 — See clear feedback on failure**
  As an admin user, when my credentials are wrong or incomplete, I want to see a clear, non-technical error message so that I know what to correct.
- **US-3 — Stay signed in during my working session**
  As an admin user, once I log in successfully, I want to remain authenticated for a reasonable working period so that I don't have to re-enter credentials constantly.
- **US-4 — Be redirected to the Admin Panel after login**
  As an admin user, after a successful login, I want to be taken directly to the dashboard so that I can start my work immediately.
- **US-5 — Be protected from seeing admin content when not signed in**
  As the business, I want unauthenticated visitors redirected to the login page so that the admin area is not exposed.

## 4. Functional Scope

### In Scope
- A single web login page accessible at a public URL.
- Email + password form with a submit action.
- Basic client-side validation (required fields, email format, password presence).
- Server-side credential validation against the existing `users` store.
- Successful login establishes an authenticated session and routes the user to the Admin dashboard.
- Failed login shows a user-friendly error message without revealing which field was wrong.
- Unauthenticated access to protected pages redirects to the login page.

### Out of Scope (not for this iteration)
- Self-service registration / account creation.
- Password reset / forgot password flow.
- Single Sign-On (SSO), OAuth, or social login.
- Multi-factor authentication (MFA) / OTP / passkeys.
- "Remember me" persistent session or device trust.
- Account lockout, CAPTCHA, or rate-limit UI.
- Role-based authorization UI (only authentication is in scope).
- Internationalization / multi-language copy.

## 5. High-Level Acceptance Criteria

1. A user can visit the login page in a modern desktop browser and see an email field, a password field, and a submit button.
2. Submitting valid credentials for an existing user signs them in and lands them on the Admin dashboard.
3. Submitting invalid or unknown credentials keeps the user on the login page and shows a clear, generic error message.
4. Submitting empty or malformed fields shows inline validation without calling the server.
5. Visiting a protected admin URL while signed out redirects the user to the login page.
6. A signed-in user who returns to the login URL is sent to the dashboard (or at minimum not forced to log in again within the active session window).
7. The password value is never shown in plain text on screen by default and is never stored in the browser in a human-readable form.

## 6. Non-Functional Notes

- **Security (baseline):**
  - Passwords must never be logged, echoed, or transmitted in plaintext over the network — credentials are sent only over the secured login endpoint.
  - Stored passwords remain hashed (existing bcrypt approach).
  - Error messages must not disclose whether the email exists or whether the password was the wrong part.
  - Session credentials (token) must expire after a reasonable working period.
- **Accessibility (baseline):**
  - Form fields have visible labels and are reachable and submittable using keyboard only.
  - Error messages are perceivable (not communicated by color alone) and announced to assistive tech.
  - Sufficient text contrast and a clear focus state on inputs and the submit button.
- **Usability:**
  - The page loads quickly and works on current evergreen desktop browsers.
  - Submit action shows a brief pending state so the user knows the request is in flight.
- **Reliability:**
  - If the backend is unreachable, the user sees a generic "please try again" message instead of a technical error.

## 7. Assumptions & Dependencies

- Users already exist in the database (seed provides `admin@example.com`); no new user creation is needed for this iteration.
- The existing authentication endpoint and JWT mechanism will be reused; any refinement is a Phase 2 concern (TECH_SPEC).
- Only the Admin Panel (web) is in scope — no mobile app or public site login.

## 8. Open Questions (for stakeholder review)

- Confirm the session duration is acceptable for admin users' working patterns.
- Confirm no branding/visual guidelines must be followed beyond the current Admin Panel look.
- Confirm that "forgot password" truly can be deferred — is there a manual recovery process available to admins in the meantime?
