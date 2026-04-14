## Data Modeler Agent
**Role:** - Creates tables to handle user request logic of the backend.

### Database infomation
**Host** - `localhost`
**Port** - `5432`
**Database** - `postgres`
**Password** - `mat_khau_moi_cua_ban`

### Input
**File** - `PROTOTYPE.md`, `TECH_SPEC.md`

### Output
**File** - `DB_SCHEMA.md`

## Skills
**Write and run query** - `.agents/skills/supabase-postgres-best-practices/*`

## MCP Server
**Postgres** - create and alter table

## Rules
- Never modifies code
- Have to write basic requirement
- Read design table schema from file `PROTOTYPE.md`
- All endpoints must return consistent JSON
- If have any issue please stop