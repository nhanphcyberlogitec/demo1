# BUG REPORT — Login Page

**Branch:** `develop-test-2`
**Date:** 2026-04-07
**Tester:** QC Agent (static code review)

---

## Summary

**9 bugs found** (3 High, 4 Medium, 2 Low) across backend and frontend.

---

## Bug #1 — [Backend] Error response uses `error` key instead of `message`

- **Severity:** High
- **File:** `core/main.py:45`
- **Steps:** Send POST `/api/auth/login` with a password shorter than 6 characters.
- **Expected:** Response body: `{ "success": false, "data": null, "message": "Invalid email or password" }` (per API contract).
- **Actual:** Response body: `{ "success": false, "error": "Invalid email or password" }` — uses `error` key instead of `message`, and `data: null` is missing.

---

## Bug #2 — [Frontend] LoginResponse type and error handling use `error` instead of `message`

- **Severity:** High
- **File:** `admin/app/login/page.tsx:13,42`
- **Steps:** Trigger a login failure (wrong password).
- **Expected:** Frontend reads `data.message` from the API response (per contract).
- **Actual:** Frontend type defines `error?: string` and reads `data.error`. This matches the backend bug (#1) so errors display correctly today, but both deviate from the API contract. If the backend is fixed to use `message`, the frontend will break.

---

## Bug #3 — [Backend] User `id` is integer instead of string

- **Severity:** High
- **File:** `core/main.py:52`
- **Steps:** Send a valid login request.
- **Expected:** `data.user.id` is a string (per API contract: `"id": string`).
- **Actual:** `data.user.id` is `1` (integer).

---

## Bug #4 — [Frontend] Page heading says "Login" instead of "Welcome back"

- **Severity:** Medium
- **File:** `admin/app/login/page.tsx:61`
- **Steps:** Navigate to `/login`.
- **Expected:** Page title/branding area shows app name with subtitle "Welcome back" (per PROTOTYPE.md UI layout).
- **Actual:** Heading is `<h1>Login</h1>`. No "Welcome back" subtitle.

---

## Bug #5 — [Frontend] Error message rendered below button instead of below password field

- **Severity:** Medium
- **File:** `admin/app/login/page.tsx:99-101`
- **Steps:** Submit invalid credentials to trigger an error message.
- **Expected:** Error message appears between the password field and the submit button (per PROTOTYPE.md: "Appears below the password field").
- **Actual:** Error message is rendered after the `</form>` tag, placing it below the submit button.

---

## Bug #6 — [Frontend] Input fields not disabled during loading state

- **Severity:** Medium
- **File:** `admin/app/login/page.tsx:67-87`
- **Steps:** Click "Sign In" and observe inputs during the API request.
- **Expected:** Both email and password inputs are disabled during submission (per PROTOTYPE.md: "both input fields are disabled to prevent re-submission").
- **Actual:** Only the submit button is disabled (`disabled={loading}`). The input fields remain editable.

---

## Bug #7 — [Frontend] No spinner in submit button during loading

- **Severity:** Medium
- **File:** `admin/app/login/page.tsx:90-96`
- **Steps:** Click "Sign In" and observe the button during loading.
- **Expected:** Button shows "Signing in..." text AND a spinner icon (per PROTOTYPE.md: "a spinner appears inside the button").
- **Actual:** Button text changes to "Signing in..." but no spinner/loading indicator is rendered.

---

## Bug #8 — [Frontend] Input placeholders do not match spec

- **Severity:** Low
- **File:** `admin/app/login/page.tsx:73,86`
- **Steps:** Navigate to `/login` and observe placeholder text.
- **Expected:** Email placeholder: "Enter your email". Password placeholder: "Enter your password" (per PROTOTYPE.md).
- **Actual:** Email placeholder: "user@example.com". Password placeholder: "********".

---

## Bug #9 — [Frontend] No alert icon on error message

- **Severity:** Low
- **File:** `admin/app/login/page.tsx:99-101`
- **Steps:** Trigger a login error.
- **Expected:** Error message shows with an alert icon (per PROTOTYPE.md: "Red text (#DC2626) with an alert icon").
- **Actual:** Only plain red text is rendered. No icon.

---

## Test Case Coverage

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 1 | Happy path (valid email + password >= 6) | Pass (with caveats) | Login succeeds, token stored, redirects to /dashboard. Bug #3: user.id is int not string. |
| 2 | Empty fields | Pass | HTML `required` attribute prevents submission with empty fields. |
| 3 | Invalid credentials (password < 6 chars) | Pass (with caveats) | Returns 401 and error displays. Bug #1/#2: response key is `error` not `message`. |
| 4 | Loading state | Partial Fail | Button text changes to "Signing in..." and is disabled. But inputs are NOT disabled (Bug #6) and no spinner (Bug #7). |
| 5 | UI check | Partial Fail | Layout/styling matches spec. Heading text wrong (Bug #4), placeholders wrong (Bug #8), error position wrong (Bug #5), no alert icon (Bug #9). |
