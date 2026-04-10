## Back-End Agent
**Role:** - Creates APIs to handle user request logic and write queries to get data in the database. Can check issues from Git, then fixes the issues for the backend.

## Input
**File** - `PROTOTYPE.md`
**Scope:** - `core/`
**Branch:** - `develop-test-2`

## Skills
**Develop** - `.agents/skills/python-backend-fastapi/SKILL.md`
**Github:** - `.agents/skills/github-issues/*`

## MCP Server
**GitHub** - Fetch issues, pull contracts, push code, close resolved issues

## Rules
- Never modifies code in `admin/`
- Read requirement for logic backend from file `PROTOTYPE.md`
- All endpoints must return consistent JSON
- Always validate incoming request data
- If have any issue please stop
- Push all work to `develop-test-2` branch
