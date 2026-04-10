# Agent Team Workflow

**MANDATORY: For EVERY user request (feature, bug fix, refactor, or any requirement), you MUST create an Agent Team using `TeamCreate` and orchestrate teammates via `TaskCreate`, `TaskUpdate`, and `SendMessage`. Never use the `Agent` tool with `subagent_type` to spawn subagents — always use the Team workflow to create real parallel Claude Code sessions.**

This project uses a multi-agent team for all work. You (the main Claude) act as the **Team Lead / Orchestrator**. For every task, create a team and spawn ALL agents from `.claude/agents/` in parallel.

## Auto-Discover Agents

**Always scan `.claude/agents/*.md` to discover all available agents.** Do NOT hardcode agent names or roles — read each agent definition file to understand its role, inputs, outputs, and rules. If an agent file is added or removed from `.claude/agents/`, the team adapts automatically.

## How to Run the Team (Step-by-Step)

### Step 1 — Create the team

```
TeamCreate({ team_name: "feature-name", description: "Brief description of work" })
```

### Step 2 — Discover agents and create tasks

1. Scan `.claude/agents/*.md` to get all agent definitions
2. Read each agent definition file to understand its role
3. Create one task per agent using `TaskCreate`
4. Wire dependencies based on each agent's `Input` field (e.g., if an agent reads `PROTOTYPE.md`, it depends on the agent that writes `PROTOTYPE.md`)

### Step 3 — Spawn ALL agents in parallel

Spawn every agent at once in a **single message** with multiple `Agent` calls, all with `run_in_background: true`. Each agent receives its definition file content + task description as the prompt.

```
// Spawn ALL agents in ONE message for maximum parallelism
Agent({
  team_name: "feature-name",
  name: "publisher",
  prompt: "<contents of .claude/agents/publisher.md>\n\nYour task: <task description>",
  run_in_background: true
})

Agent({
  team_name: "feature-name",
  name: "designer",
  prompt: "<contents of .claude/agents/designer.md>\n\nYour task: <task description>",
  run_in_background: true
})

Agent({
  team_name: "feature-name",
  name: "database",
  prompt: "<contents of .claude/agents/database.md>\n\nYour task: <task description>",
  run_in_background: true
})

// ... repeat for ALL agents found in .claude/agents/
```

Then assign all tasks:
```
TaskUpdate({ taskId: "1", owner: "publisher", status: "in_progress" })
TaskUpdate({ taskId: "2", owner: "designer", status: "in_progress" })
TaskUpdate({ taskId: "3", owner: "database", status: "in_progress" })
// ... repeat for all agents
```

Agents that have dependencies will wait for their input files (e.g., `PROTOTYPE.md`, `DB_SCHEMA.md`) to be created by upstream agents before proceeding. Each agent's definition file specifies what it reads and what it produces.

### Step 4 — Monitor and coordinate

- **Messages arrive automatically** — teammates send messages when they finish or need help
- **Check task list** — use `TaskList()` to see overall progress
- **Send instructions** — use `SendMessage({ to: "agent-name", message: "..." })` to guide a teammate
- **Reassign if needed** — use `TaskUpdate` with `owner` to reassign tasks

### Step 4.1 — Bug-fix loop (QC → Frontend / Backend)

After the QC agent finishes testing and creates GitHub issues, the orchestrator triggers frontend and backend agents to fix them:

1. **QC finishes** — QC agent creates GitHub issues labeled `frontend` or `backend` and notifies the orchestrator
2. **Orchestrator notifies fix agents** — Send messages to frontend and backend agents to check GitHub issues:
   ```
   SendMessage({ to: "frontend", message: "QC has created GitHub issues. Check issues labeled 'frontend' on the repo, fix them, and close the issues when done." })
   SendMessage({ to: "backend", message: "QC has created GitHub issues. Check issues labeled 'backend' on the repo, fix them, and close the issues when done." })
   ```
3. **Agents fix and close** — Each agent:
   - Fetches open GitHub issues with its label (`frontend` or `backend`) using the GitHub MCP server
   - Reads the issue description and repro steps
   - Fixes the code in its scope (`admin/` or `core/`)
   - Pushes the fix to `develop-test-2`
   - Closes the GitHub issue with a comment referencing the fix
4. **Orchestrator re-tests** — Once both agents report done, ask QC to re-test:
   ```
   SendMessage({ to: "qc", message: "Frontend and backend have fixed all issues. Re-run tests to verify all fixes. If new issues are found, create new GitHub issues." })
   ```
5. **Repeat until green** — If QC finds new issues, repeat from sub-step 2. Continue the loop until QC reports all test cases passed with zero open issues.

### Step 4.2 — Expert review (after all QC tests pass)

The Expert agent runs **only after QC confirms all test cases have passed** (zero open issues):

1. **Orchestrator triggers Expert** — Send a message to the expert agent:
   ```
   SendMessage({ to: "expert", message: "All QC test cases have passed. Review the full implementation — code quality, architecture, security, performance — and write your findings to EXPERT_REVIEW.md." })
   ```
2. **Expert reviews and writes** — The expert agent reviews the codebase and produces `EXPERT_REVIEW.md`
3. **Expert notifies orchestrator** — Expert marks its task as completed
4. **Orchestrator presents to user** — Show the user `EXPERT_REVIEW.md` for final review

### Step 5 — Shutdown the team

When ALL tasks are completed:

```
// Shutdown each teammate
SendMessage({ to: "publisher", message: { type: "shutdown_request" } })
SendMessage({ to: "designer", message: { type: "shutdown_request" } })
// ... repeat for all active teammates

// Clean up team resources
TeamDelete()
```

## Shared Files (Inter-Agent Communication)

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `PROTOTYPE.md` | `publisher` | All agents | Functional spec: UI design, backend logic, DB schema |
| `FIGMALINK.md` | (provided by user) | `designer`, `frontend` | Figma file URL for design work |
| `DB_SCHEMA.md` | `database` | `backend` | Table definitions and relationships |
| `EXPERT_REVIEW.md` | `expert` | Final output | Review findings and recommendations |
| GitHub Issues | `qc` | `frontend`, `backend` | Bug reports labeled `frontend` or `backend`; agents fetch, fix, and close them |

## Agent Skills

Agents reference reusable skill definitions in `.agents/skills/`:

- `.agents/skills/python-backend-fastapi/` — Backend development patterns (used by `backend` agent)
- `.agents/skills/frontend-nextjs/` — Frontend development patterns (used by `frontend` agent)
- `.agents/skills/github-issues/` — GitHub issue management (used by `backend`, `frontend`, `qc` agents)
- `.agents/skills/supabase-postgres-best-practices/` — PostgreSQL best practices (used by `database` agent)

## Important Rules for the Orchestrator

1. **Always discover agents from `.claude/agents/*.md`** — never hardcode agent list
2. **Spawn ALL agents in parallel in a single message** — agents self-coordinate via shared files
3. **Always read the agent definition file** before passing it as the prompt to `Agent`
4. **Include task context in the prompt** — append the specific task description and any relevant shared file contents
5. **Use `run_in_background: true`** for all agent spawns so you can continue orchestrating
6. **Each agent gets its own task** — one agent per task, one task per agent at a time
7. **Teammates communicate via `SendMessage`** — plain text only, no JSON status messages
8. **Use `TaskUpdate` for status changes** — agents mark their own tasks as `completed` when done
9. **Ask user for review at key checkpoints** — after Publisher writes `PROTOTYPE.md`, after Designer finishes Figma, and after Expert writes `EXPERT_REVIEW.md`

## Agent Scope Boundaries

- **Backend agent** (`backend`): only modifies files in `core/`
- **Frontend agent** (`frontend`): only modifies files in `admin/`
- **Publisher, Designer, Expert agents**: never write code — they produce spec/review docs only
- **Database agent** (`database`): never modifies code — only creates/alters tables via MCP Postgres tool
- **QC agent** (`qc`): never modifies code — runs tests and creates GitHub issues
- **All agents push to branch**: `develop-test-2`
