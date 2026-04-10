# Architecture

## Backend (`core/`)

- **Entry point**: `core/main.py` — FastAPI app with CORS middleware (allows `localhost:3000`). Currently contains all route handlers directly (no separate router files yet).
- **Database**: `core/database.py` — `get_connection()` uses `ThreadedConnectionPool` (min=2, max=10). Use `release_connection()` to return connections to the pool.
- **Seeding**: `core/seed.py` — creates schema and seed data
- **Auth**: JWT-based (python-jose + bcrypt). Tokens expire after 60 min. Secret key and JWT config constants are in `main.py`.
- **Endpoints**:
  - `POST /api/auth/login` — validates email format + password length, checks bcrypt hash, returns JWT token + user object

## API Response Format

All API endpoints return a consistent envelope:

```json
{ "success": true/false, "data": {...} | null, "message": "" }
```

HTTP status codes: `200` success, `401` auth failure, `422` validation error.

## Frontend (`admin/`)

- **App Router**: pages in `admin/app/`, all page components are client components (`"use client"`)
- **Auth flow**: Login page (`admin/app/login/page.tsx`) POSTs to `http://localhost:8000/api/auth/login`, stores `token` and `user` JSON in localStorage, redirects to `/dashboard`
- **Auth guard pattern**: Protected pages check `localStorage` for `token`/`user` in a `useEffect` and redirect to `/login` if missing
- **Dashboard**: `admin/app/dashboard/page.tsx` — Protected page with auth guard, shows welcome message and logout button
- **Root page** (`/`): Redirects to `/login`
- **Layout**: `admin/app/layout.tsx` — sets page title "Admin Panel", loads Geist font family
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss`

## Cross-cutting

- Frontend calls backend at hardcoded `http://localhost:8000`
- CORS is configured for `http://localhost:3000` only
- No shared types or API client — frontend uses raw `fetch()`
