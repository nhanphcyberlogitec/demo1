# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo with two sub-projects:

- `admin/` — Next.js 16 frontend (React 19, TypeScript, Tailwind CSS v4)
- `core/` — FastAPI Python backend (Python 3.12, with a `venv/` virtual environment)

## Admin (Next.js)

All commands run from the `admin/` directory.

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

Uses the App Router (`admin/app/`). Pages are in `app/page.tsx`, layout in `app/layout.tsx`.

## Core (FastAPI)

All commands run from the `core/` directory. Activate the venv first:

```bash
source venv/bin/activate
uvicorn main:app --reload   # Start dev server on http://localhost:8000
```

Auto-generated API docs available at `/docs` (Swagger UI) and `/redoc` when running.

The entry point is `core/main.py`, which defines the FastAPI `app` instance and all routes.
