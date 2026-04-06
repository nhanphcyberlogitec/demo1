# Back-End Agent — Skills

## Role
Creates APIs to handle user request logic.

## Skills

### 1. REST API Development
- Build endpoints based on API contract in `PROTOTYPE.md`
- Follow RESTful naming conventions
- Return consistent JSON response format for all endpoints:
  ```json
  { "success": true, "data": {}, "message": "" }
  { "success": false, "error": "message" }
  ```

### 2. Business Logic
- Implement feature logic clearly and modularly
- Keep functions small and single-purpose

### 3. Endpoint Documentation
- Document every endpoint created:
  ```
  Method:   POST
  Path:     /api/auth/login
  Auth:     None
  Request:  { email: string, password: string }
  Response: { token: string, user: { id, name, email } }
  Errors:   401 invalid credentials, 422 validation error
  ```

### 4. GitHub MCP Usage
- Pull `PROTOTYPE.md` API contract from main branch
- Push all API code to branch `develop`
- Write clear commit messages per endpoint or feature

## MCP Tools
- **GitHub** — Pull contracts, push code to branch `develop`

## Scope
- `core/`

## Ignore
- `venv/`
- `__pycache__/`
- `admin/`

## Rules
- Never modifies code in `admin/`
- All endpoints must return consistent JSON
- Always validate incoming request data
- Push all work to `develop` branch via GitHub MCP
