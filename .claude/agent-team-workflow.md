# Agent Team Workflow

**MANDATORY: For EVERY user request (feature, bug fix, refactor, or any requirement), you MUST create an Agent Team using `TeamCreate` and orchestrate teammates via `TaskCreate`, `TaskUpdate`, and `SendMessage`. Never use the `Agent` tool with `subagent_type` to spawn subagents — always use the Team workflow to create real parallel Claude Code sessions.**

This project uses a multi-agent team for all work. You (the main Claude) act as the **Team Lead / Orchestrator**. The team runs in **phases** — agents inside a phase run in parallel, and phases are gated on their predecessor's completion.

## Auto-Discover Agents

**Always scan `.claude/agents/*.md` to discover all available agents.** Do NOT hardcode agent names or roles — read each agent definition file to understand its role, inputs, outputs, and rules. If an agent file is added or removed from `.claude/agents/`, update the phase map below accordingly.

## Phase Map

The team runs in 6 phases. Each phase lists its members, the gate that must pass before starting, and the gate that must pass before moving on.

| Phase | Members | Start Gate | Exit Gate |
|-------|---------|-----------|-----------|
| 1. Requirements | `business-analyst` | user request received | `PROTOTYPE.md` written **and** user approved |
| 2. Specification | `technical-writer` | Phase 1 exit gate | `TECH_SPEC.md` written **and** user approved |
| 3. Design & Build (parallel) | `data-modeler`, `backend-developer`, `ui-designer` | Phase 2 exit gate | `DB_SCHEMA.md` + user approved, `BACKEND_API.md` + user approved, Figma design + user approved |
| 4. Frontend Integration | `frontend-developer` | Phase 3 exit gate (needs both Figma and `BACKEND_API.md`) | frontend code pushed to `develop-test-3` **and** user approved the built UI |
| 5. Test & Fix Loop | `qa-tester` (+ `frontend-developer` / `backend-developer` for fixes) | Phase 4 exit gate (user approved frontend) | all qa-tester test cases pass, zero open GitHub issues |
| 6. Review | `reviewer` | Phase 5 exit gate | `EXPERT_REVIEW.md` written, presented to user |

## How to Run the Team (Step-by-Step)

### Step 1 — Create the team

```
TeamCreate({ team_name: "feature-name", description: "Brief description of work" })
```

### Step 2 — Discover agents and create tasks up front

1. Scan `.claude/agents/*.md` to get all agent definitions
2. Read each agent definition file to understand its role, inputs, outputs
3. Create one task per agent using `TaskCreate`, all in `pending` status
4. Record each task's ID — you will flip tasks to `in_progress` when their phase starts

### Step 3 — Run phases sequentially, parallel within each phase

For each phase in the Phase Map:

1. **Confirm start gate** — verify the previous phase's exit gate has passed (files present, user approved where required). Do not start a phase early.
2. **Spawn that phase's agents in a single message** — all `Agent` calls in one response, all with `run_in_background: true`. Each agent's prompt = full contents of its `.claude/agents/<name>.md` file + the concrete task description + any input files it needs to read.
3. **Flip that phase's tasks to `in_progress`** via `TaskUpdate`.
4. **Wait for exit gate** — teammates will `SendMessage` when they finish and mark their tasks `completed`. When all members of the phase are `completed` and the exit gate is satisfied, proceed.
5. **Shut down agents no longer needed** (see Step 5 — early shutdown) before starting the next phase.

Example — spawning Phase 3 (parallel):

```
// ALL three spawned in ONE message
Agent({ team_name: "feature-name", name: "data-modeler",
        prompt: "<contents of .claude/agents/data-modeler.md>\n\nTask: <...>\n\nInputs: PROTOTYPE.md, TECH_SPEC.md",
        run_in_background: true })
Agent({ team_name: "feature-name", name: "backend-developer",
        prompt: "<contents of .claude/agents/backend-developer.md>\n\nTask: <...>\n\nInputs: PROTOTYPE.md, TECH_SPEC.md, DB_SCHEMA.md (will be produced by data-modeler — wait for it AND for the orchestrator's 'DB_SCHEMA.md approved' message before writing DB-touching code)",
        run_in_background: true })
Agent({ team_name: "feature-name", name: "ui-designer",
        prompt: "<contents of .claude/agents/ui-designer.md>\n\nTask: <...>\n\nInputs: TECH_SPEC.md, FIGMALINK.md",
        run_in_background: true })

TaskUpdate({ taskId: "<data-modeler>", status: "in_progress" })
TaskUpdate({ taskId: "<backend-developer>", status: "in_progress" })
TaskUpdate({ taskId: "<ui-designer>", status: "in_progress" })
```

Note on intra-phase dependencies: in Phase 3, `backend-developer` reads `DB_SCHEMA.md` produced by `data-modeler`. Both are spawned together, but `backend-developer` is gated on **user approval** of `DB_SCHEMA.md`:

1. `data-modeler` writes `DB_SCHEMA.md` and applies tables via Postgres MCP, then notifies the orchestrator.
2. Orchestrator shows `DB_SCHEMA.md` to the user and pauses for approval (blocking checkpoint).
3. Once the user approves, orchestrator sends `"DB_SCHEMA.md approved"` to `backend-developer`.
4. Only then does `backend-developer` proceed to write DB-touching code.
5. `ui-designer` runs independently and is not affected by this gate.

If `DB_SCHEMA.md` already exists at Phase 3 start (carried from a prior run), `data-modeler` still runs to reconcile tables, but the approval step is still required before `backend-developer` consumes the file.

**`BACKEND_API.md` user-approval gate:** after `backend-developer` finishes writing endpoints and produces `BACKEND_API.md`:

1. `backend-developer` notifies the orchestrator that `BACKEND_API.md` is ready.
2. Orchestrator shows `BACKEND_API.md` to the user and pauses for approval (blocking checkpoint).
3. Once approved, orchestrator sends `"BACKEND_API.md approved"` to `frontend-developer` (who will pick it up when Phase 4 starts).
4. Phase 4 (`frontend-developer`) may not call any endpoint until this approval notice is received.

### Step 4 — Monitor and coordinate

- **Messages arrive automatically** — teammates send messages when they finish or need help
- **Check progress** — use `TaskList()`
- **Send instructions** — use `SendMessage({ to: "agent-name", message: "..." })`
- **Reassign if needed** — use `TaskUpdate` with `owner`

### Step 4.1 — User review checkpoints

Pause the workflow and ask the user for approval before advancing past these gates:

1. After Phase 1 — show `PROTOTYPE.md`
2. After Phase 2 — show `TECH_SPEC.md`
3. Mid-Phase 3 — show `DB_SCHEMA.md` as soon as `data-modeler` finishes. Once approved, notify `backend-developer` with `"DB_SCHEMA.md approved"` so it can start DB-touching code.
4. Mid/End-Phase 3 — show `BACKEND_API.md` as soon as `backend-developer` finishes. Once approved, notify `frontend-developer` with `"BACKEND_API.md approved"`.
5. End of Phase 3 — show Figma design
6. After Phase 4 — `frontend-developer` has pushed `admin/` to `develop-test-3`; run the UI locally and have the user approve it. Once approved, notify `qa-tester` with `"frontend approved"` to start testing.
7. After Phase 6 — show `EXPERT_REVIEW.md`

If the user requests changes, re-send the relevant agent a message with the feedback and wait for re-completion before re-asking.

### Step 4.2 — Bug-fix loop (Phase 5)

After `qa-tester` files GitHub issues:

1. **qa-tester finishes round** — it creates GitHub issues labeled `frontend` or `backend` and messages the orchestrator
2. **Orchestrator notifies fix agents**:
   ```
   SendMessage({ to: "frontend-developer", message: "qa-tester filed GitHub issues. Fetch issues labeled 'frontend', fix, push to develop-test-3, and close each issue with a fix reference." })
   SendMessage({ to: "backend-developer", message: "qa-tester filed GitHub issues. Fetch issues labeled 'backend', fix, push to develop-test-3, and close each issue with a fix reference." })
   ```
3. **Agents fix and close** — each fetches its labeled issues via GitHub MCP, reads repro steps, fixes in scope (`admin/` or `core/`), pushes to `develop-test-3`, closes the issue
4. **Orchestrator triggers re-test**:
   ```
   SendMessage({ to: "qa-tester", message: "Fixes are in. Re-run the full test suite. If new failures surface, file new issues." })
   ```
5. **Loop until green** — repeat from sub-step 2 until `qa-tester` reports all test cases pass with zero open issues. That satisfies Phase 5's exit gate.

### Step 4.3 — Review (Phase 6)

Runs **only after Phase 5 exit gate passes**:

1. **Orchestrator triggers reviewer**:
   ```
   SendMessage({ to: "reviewer", message: "All qa-tester cases pass, zero open issues. Review full implementation — code quality, architecture, security, performance — and write findings to EXPERT_REVIEW.md." })
   ```
2. Reviewer writes `EXPERT_REVIEW.md` and marks its task `completed`
3. Orchestrator presents `EXPERT_REVIEW.md` to the user

### Step 5 — Shut down agents (early + final)

**Early shutdown** — once an agent has no further work in later phases, shut it down to free resources:

| Agent | Shut down after |
|-------|-----------------|
| `business-analyst` | Phase 1 exit gate |
| `technical-writer` | Phase 2 exit gate |
| `ui-designer` | Phase 3 exit gate |
| `data-modeler` | Phase 3 exit gate (unless schema changes are needed during bug-fix loop) |
| `backend-developer` | Phase 5 exit gate (stays alive through fix loop) |
| `frontend-developer` | Phase 5 exit gate (stays alive through fix loop) |
| `qa-tester` | Phase 5 exit gate |
| `reviewer` | Phase 6 exit gate |

```
SendMessage({ to: "<agent>", message: { type: "shutdown_request" } })
```

**Final cleanup** — after all phases complete and all agents are shut down:

```
TeamDelete()
```

## Shared Files (Inter-Agent Communication)

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `PROTOTYPE.md` | `business-analyst` | `technical-writer`, `data-modeler`, `backend-developer`, `ui-designer`, `frontend-developer`, `qa-tester` | Business requirements |
| `TECH_SPEC.md` | `technical-writer` | `data-modeler`, `backend-developer`, `ui-designer`, `frontend-developer`, `qa-tester` | Functional/technical specification |
| `FIGMALINK.md` | user | `ui-designer`, `frontend-developer` | Figma file URL |
| `DB_SCHEMA.md` | `data-modeler` | `backend-developer` | Tables and relationships |
| `BACKEND_API.md` | `backend-developer` | `frontend-developer`, `qa-tester` | API endpoints and contracts |
| `BUG_REPORT.md` | `qa-tester` | `frontend-developer`, `backend-developer` | Test findings summary |
| GitHub Issues | `qa-tester` | `frontend-developer`, `backend-developer` | Bug tickets labeled `frontend`/`backend` |
| `EXPERT_REVIEW.md` | `reviewer` | user | Final review findings |

## Agent Skills

Reusable skill definitions in `.agents/skills/`:

- `.agents/skills/python-backend-fastapi/` — used by `backend-developer`
- `.agents/skills/frontend-nextjs/` — used by `frontend-developer`
- `.agents/skills/github-issues/` — used by `backend-developer`, `frontend-developer`, `qa-tester`
- `.agents/skills/supabase-postgres-best-practices/` — used by `data-modeler`

## Important Rules for the Orchestrator

1. **Always discover agents from `.claude/agents/*.md`** — never hardcode
2. **Spawn agents phase-by-phase**, all members of a phase in a single message, `run_in_background: true`
3. **Never start a phase before its start gate passes** — check files and user approval where required
4. **Always read the agent definition file** and include it verbatim in the `Agent` prompt
5. **Include task context and input file list** in each agent's prompt
6. **One task per agent at a time** — agents flip their own task to `completed` when done
7. **Plain-text `SendMessage`** for teammate communication — no JSON envelopes
8. **Pause at user-review checkpoints** (after Phase 1, 2, mid-Phase 3 for `DB_SCHEMA.md`, mid/end-Phase 3 for `BACKEND_API.md`, end-Phase 3 for Figma, after Phase 4 for the built frontend, and after Phase 6) — do not advance / do not unblock gated agents without user approval
9. **Shut down agents early** once their phase obligations are discharged
10. **Keep developer agents alive through Phase 5** — they are needed for the bug-fix loop

## Agent Scope Boundaries

- **backend-developer**: only modifies files in `core/`
- **frontend-developer**: only modifies files in `admin/`
- **business-analyst, technical-writer, ui-designer, reviewer**: never write code — spec/review docs only
- **data-modeler**: never modifies code — only creates/alters tables via MCP Postgres
- **qa-tester**: never modifies code — runs tests, files GitHub issues
- **All code agents push to branch**: `develop-test-3`
