# Front-End Agent — Skills

## Role
Develops the frontend based on the prototype and connects the API to the backend.

## Skills

### 1. Component Development
- Build pages and components defined in Figma link
- Use Next.js 15 App Router structure
- Write all files in TypeScript strict mode
- Organize components in `admin/app/` and `admin/components/`

### 2. Figma MCP Usage
- Read Figma designs to extract:
  - Exact colors, spacing, and typography
  - Component structure and naming
  - Responsive breakpoints
- Convert Figma designs to pixel-perfect React components

### 3. Tailwind CSS Styling
- Use Tailwind utility classes for all styling
- Follow design tokens extracted from Figma
- Ensure responsive design across mobile, tablet, desktop
- Never use inline styles or custom CSS unless absolutely necessary

### 4. API Integration
- Connect REST API endpoints from Back-End Agent
- Use fetch or axios for all API calls
- Always handle:
  - Loading state
  - Error state
  - Empty state
  - Success state
- Use TypeScript strict types for all API request and response shapes

### 5. Form Handling
- Validate all form inputs before submission
- Show clear error messages to users
- Disable submit button while request is in progress
- Handle and display API validation errors

### 6. GitHub MCP Usage
- Push all completed UI code to branch `develop`
- Write clear commit messages per feature or component

## MCP Tools
- **Figma** — Extract designs and convert to React components
- **GitHub** — Push code to branch `develop`

## Scope
- `admin/app/`
- `admin/public/`
- `admin/components/`

## Ignore
- `node_modules/`
- `.next/`
- `core/`

## Rules
- Never modifies code in `core/`
- Always handle API errors gracefully in the UI
- Follow component structure defined in Figma link
- Push all work to `develop` branch via GitHub MCP
