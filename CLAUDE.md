# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Monorepo with two sub-projects:

- `admin/` — Next.js 16 frontend (React 19, TypeScript, Tailwind CSS v4, App Router)
- `core/` — FastAPI backend (Python 3.12, psycopg2 for PostgreSQL)

## Setup

```bash
# Frontend
cd admin && npm install

# Backend
cd core && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

## Development Commands

### Frontend (`admin/`)

```bash
cd admin
npm run dev          # Dev server → http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint (next/core-web-vitals + typescript)
npm run test         # Jest unit tests
npm run test:watch   # Jest in watch mode
npm run test:e2e     # Playwright E2E tests (headed, Chromium)
npm run test:e2e:ui  # Playwright with UI
```

Run a single Jest test: `cd admin && npx jest path/to/file.test.tsx`
Run a single E2E test: `cd admin && npx playwright test e2e/login.spec.ts`

Jest config: `admin/jest.config.js` — uses `next/jest` with jsdom, path alias `@/` → `<rootDir>/`. Setup file: `admin/jest.setup.ts`.

Playwright config: `admin/playwright.config.ts` — tests in `admin/e2e/`, runs against `http://localhost:3000`, Chromium only, headed by default (`headless: false`). Auto-starts `npm run dev` via `webServer` config if not already running.

### Backend (`core/`)

```bash
cd core
source venv/bin/activate
uvicorn main:app --reload   # Dev server → http://localhost:8000
python seed.py              # Seed database (creates users table + admin user)
pytest                      # Run backend tests
pytest tests/test_auth.py   # Run a single test file
```

API docs at `http://localhost:8000/docs` (Swagger) and `/redoc` when running.

### Database

PostgreSQL on `localhost:5432`, database `postgres`, user `postgres`. Connection configured in `core/database.py` using `ThreadedConnectionPool`.

Seed script (`core/seed.py`) creates the `users` table and inserts a default admin user (`admin@example.com` / `password123`).

## Architecture

### Backend (`core/`)

- **Entry point**: `core/main.py` — FastAPI app with CORS middleware (allows `localhost:3000`). Currently contains all route handlers directly (no separate router files yet).
- **Database**: `core/database.py` — `get_connection()` uses `ThreadedConnectionPool` (min=2, max=10). Use `release_connection()` to return connections to the pool.
- **Seeding**: `core/seed.py` — creates schema and seed data
- **Auth**: JWT-based (python-jose + bcrypt). Tokens expire after 60 min. Secret key and JWT config constants are in `main.py`.
- **Endpoints**:
  - `POST /api/auth/login` — validates email format + password length, checks bcrypt hash, returns JWT token + user object

### API Response Format

All API endpoints return a consistent envelope:

```json
{ "success": true/false, "data": {...} | null, "message": "" }
```

HTTP status codes: `200` success, `401` auth failure, `422` validation error.

### Frontend (`admin/`)

- **App Router**: pages in `admin/app/`, all page components are client components (`"use client"`)
- **Auth flow**: Login page (`admin/app/login/page.tsx`) POSTs to `http://localhost:8000/api/auth/login`, stores `token` and `user` JSON in localStorage, redirects to `/dashboard`
- **Auth guard pattern**: Protected pages check `localStorage` for `token`/`user` in a `useEffect` and redirect to `/login` if missing
- **Dashboard**: `admin/app/dashboard/page.tsx` — Protected page with auth guard, shows welcome message and logout button
- **Layout**: `admin/app/layout.tsx` — sets page title "Admin Panel", loads Geist font family
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss`
- **Root page** (`/`): Server-side redirect to `/login`

### Cross-cutting

- Frontend calls backend at hardcoded `http://localhost:8000`
- CORS is configured for `http://localhost:3000` only
- No shared types or API client — frontend uses raw `fetch()`

## Agent Team Workflow

All development-related requests (features, bug fixes, refactoring, etc.) must be handled by the agent team.

See [`.claude/agent-team-workflow.md`](.claude/agent-team-workflow.md) for the complete multi-agent orchestration flow. Agent definitions are auto-discovered from `.claude/agents/*.md`. The workflow includes a QC bug-fix loop (QC creates GitHub issues → frontend/backend agents fix → QC re-tests) and an expert review phase after all tests pass.

## Code Conventions

- **Backend**: FastAPI, Python 3.12. Currently all routes in `core/main.py`; as it grows, split into one router per domain.
- **Frontend**: Next.js 16 App Router, TypeScript, Tailwind CSS v4, no mock data in production
- **Database**: PostgreSQL, `snake_case` tables/columns, `uuid` PKs, timestamped rows (`created_at`, `updated_at`)
- **API responses**: Always use `{ success, data, message }` envelope format
- **Tests**: Playwright for E2E (`admin/e2e/`), Jest for frontend unit tests (`admin/`), pytest for backend (`core/tests/`)
- **GitHub Issues**: Label as `frontend` or `backend` with repro steps
