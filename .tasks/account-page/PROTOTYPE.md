# Account Page — Business Requirements

**Document type:** Business Requirements (no functional spec, no implementation details)
**Status:** Draft — pending user review
**Author:** Business Analyst Agent
**Date:** 2026-04-14

---

## 1. Background

The admin panel currently supports administrator login (email + password, JWT-based) and a simple dashboard. There is no interface for administrators to manage the user accounts that exist in the system. As the product grows, operators need a way to view and maintain the people who can sign in.

This document describes the business need for a new **Account Page** inside the admin panel. It focuses on *what* the business needs and *why* — not on how it will be built.

## 2. Business Objective

Give administrators a single place to see and maintain user accounts so that:

- Support staff can quickly find a specific user when responding to a request.
- Admins can keep user records accurate (names, contact info) without engineering help.
- Unauthorized or inactive users can be disabled promptly to reduce risk.
- The team has visibility into who has access to the system.

## 3. Scope

### 3.1 In scope
- Viewing the list of user accounts in the system.
- Searching and filtering that list to find a specific account.
- Viewing the details of a single user account.
- Editing basic profile information on an account.
- Activating or deactivating an account (status toggle).
- Creating a new user account.
- Secure access: only authenticated admins may use the page.

### 3.2 Out of scope (for this iteration)
- Role / permission management (RBAC) beyond a single "admin" flag.
- Bulk import or export of users.
- Password reset workflows driven by email.
- Audit log UI (history of who changed what).
- Multi-factor authentication management.
- Impersonation ("login as user").

These may be revisited in later iterations.

## 4. Target Users

- **Primary:** Platform administrators responsible for user support and access control.
- **Secondary:** Operations / support staff who need to look up a user's record.

All users of the page are already authenticated admins of the system.

## 5. Business Requirements

### BR-1 — Access the account list
As an admin, I want to open an "Accounts" page from the admin panel so that I can see all users registered in the system at a glance.

**Acceptance:**
- The page is reachable only after login.
- Unauthenticated users are redirected to the login page.
- The page shows a list of user accounts with the most useful identifying fields (e.g. name, email, status, created date).

### BR-2 — Find a specific account
As an admin, I want to search and filter the account list so that I can quickly locate a user I need to work with.

**Acceptance:**
- I can search by name or email.
- I can filter by account status (e.g. active / inactive).
- Results update in a way that is responsive and easy to follow.
- If the list is long, it is paginated so performance stays acceptable.

### BR-3 — View account details
As an admin, I want to open a single user's account to see their full profile so that I have the context I need when responding to a request.

**Acceptance:**
- I can open a user from the list to see their details.
- Details include at least: name, email, status, account creation date, and last update date.

### BR-4 — Edit basic profile fields
As an admin, I want to update a user's basic profile information so that the records stay accurate when users can't do it themselves.

**Acceptance:**
- I can edit fields such as name and email.
- The system validates the input (valid email format, required fields).
- The system prevents duplicate emails.
- Saving shows clear success or error feedback.
- Cancelling discards my changes.

### BR-5 — Activate or deactivate an account
As an admin, I want to enable or disable a user's account so that I can revoke access for inactive or problematic users without deleting their record.

**Acceptance:**
- I can change an account's status between active and inactive.
- Disabled users cannot log in.
- The change is reflected immediately on the account list.
- The action is confirmed before it is applied, to avoid mistakes.

### BR-6 — Create a new account
As an admin, I want to create a new user account so that I can onboard someone without requiring them to self-register.

**Acceptance:**
- I can open a form to add a new account.
- Required fields are at minimum: name, email, initial password, and status.
- Validation prevents duplicate emails and enforces a minimum password strength.
- On success, the new user appears in the list.

### BR-7 — Secure the page
As the business, I need the Account Page to be protected so that only authorized admins can view or modify user records.

**Acceptance:**
- Only authenticated admins can load the page or trigger any action on it.
- Sensitive data (e.g. password hashes) is never shown in the UI.
- Actions that change data require the admin's active session.

## 6. Success Criteria

- An admin can find any user account by name or email in under 10 seconds.
- An admin can disable a user's access in under 30 seconds from opening the page.
- Common errors (duplicate email, invalid input) are explained clearly enough that the admin can fix them without help.
- No unauthenticated request can read or modify account data.

## 7. Assumptions

- The admin user already exists in the system and can log in (current login flow).
- Initially every admin has full rights to view and modify all user accounts; there is no role hierarchy yet.
- The existing users table is the source of truth for account data.
- The page will follow the same visual language already established by the login page and dashboard.

## 8. Open Questions (for user confirmation)

1. **Delete vs. deactivate:** Should admins be able to permanently delete a user, or is deactivation sufficient for this iteration?
2. **Password reset by admin:** Should admins be able to set / reset a user's password directly from the account page, or is that out of scope for now?
3. **Admin-vs-user distinction:** Do we need a visible "is admin" flag (and the ability to grant/revoke it) in this iteration, or treat every listed user as a regular user for now?
4. **Self-protection:** Should an admin be prevented from deactivating or deleting their own account?
5. **Account creation:** Is admin-created account creation needed in this first version, or can it wait until after list/view/edit/status are shipped?
6. **Audit trail:** Is a visible log of changes (who edited what, when) required now, or deferred?

Please confirm answers (or defer) before moving to the functional/design phase.

---

**Review requested.** Please review this PROTOTYPE.md and confirm scope + open questions before the next agent proceeds.
