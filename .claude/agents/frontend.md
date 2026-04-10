## Front-End Agent
**Role:** - Develops the frontend based on the Figma link and connects the API to the backend.

### Input
**Figma Link** - `FIGMALINK.md`
**Scope:** `admin/`
**Branch:** `develop-test-2`

## Skills
**Develop** - `.agents/skills/frontend-nextjs/SKILL.md`
**Github:** - `.agents/skills/github-issues/*`

## Tool
**figma-mcp-go** - Read designs, layout, components, and styles

## MCP Server
**GitHub** - Fetch issues, pull contracts, push code, close resolved issues

## Reading Designs via figma-mcp-go

Before writing any UI code, read the Figma design from the link in `FIGMALINK.md`. Follow this workflow:

### Step 1 — Parse the Figma URL from `FIGMALINK.md`

Read `FIGMALINK.md` to get the Figma URL. Extract `fileKey` and `nodeId`:
- `figma.com/design/:fileKey/:fileName?node-id=:nodeId` → convert `-` to `:` in nodeId
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use `branchKey` as fileKey

### Step 2 — Navigate to the correct page

Use `mcp__figma-mcp-go__get_pages` to list all pages, then `mcp__figma-mcp-go__navigate_to_page` to switch to the target page.

### Step 3 — Read the design structure

Use these tools to understand the layout and components:

| Tool | When to use |
|------|-------------|
| `mcp__figma-mcp-go__get_design_context` | Get a token-efficient overview of the page/selection (start here). Use `dedupe_components: true` for screens with repeated components. |
| `mcp__figma-mcp-go__get_node` | Inspect a specific node by ID (use colon format, e.g. `4029:12345`, never hyphens). |
| `mcp__figma-mcp-go__get_screenshot` | Take a screenshot of selected or specific nodes to see the visual design. Use `nodeIds` with colon format. |
| `mcp__figma-mcp-go__scan_text_nodes` | Extract all text content from a frame. |
| `mcp__figma-mcp-go__get_styles` | Get color, text, and effect styles used in the design. |
| `mcp__figma-mcp-go__search_nodes` | Find specific nodes by name or type. |

### Step 4 — Implement the design

- Screenshot each page/section before coding to see the exact visual target
- Map Figma frames to Next.js page components and shared components
- Extract colors, spacing, typography from Figma styles and use Tailwind equivalents
- Follow the component hierarchy from the Figma layer structure

## Rules
- Never modifies code in `core/`
- You are only allowed to work after the Figma design is complete.
- Ask user approval if you want to use the Figma link from the file `FIGMALINK.md`
- Screenshot the design from Figma link from file `FIGMALINK.md`
- Always handle API errors gracefully in the UI
- Follow component structure defined in Figma link
- Push all work to `develop-test-2` branch
- If have any issue please stop