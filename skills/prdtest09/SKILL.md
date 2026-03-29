---
name: prdtest09
description: "Deterministic benchmark PRD for a small frontend component app verified by build and tests, not browser automation. Use when the user asks for prdtest09, a frontend-no-browser benchmark, or a cheap UI-oriented Ralph benchmark."
owner: ralph
scope: project
---

# PRDTEST09 Frontend Build-Only UI

Generate a deterministic compact JSON PRD for a small frontend benchmark that does not require browser automation.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and recognizable.

## Required Top-Level Values

- `project`: `PRDTEST09 Frontend Build-Only UI`
- `overview`: Small React app with one styled interactive component, focused tests, build verification, and README instructions, intentionally avoiding browser-check dependence.
- `qualityGates`:
  - `npm test`
  - `npm run build`

## Required Assumptions

- Use React with a lightweight test setup
- Keep the UI intentionally small
- Do not require browser automation, screenshots, or Playwright

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the frontend app shell`
- Scope:
  - create the React project shell
  - add a single-page layout
  - define the component structure

### US-002

- Title: `Implement the styled interactive component`
- Scope:
  - add one deterministic interaction
  - add intentional styling
  - keep the logic component-scoped

### US-003

- Title: `Add tests build verification and README`
- Scope:
  - add focused component tests
  - verify with test and build only
  - add README instructions

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep this benchmark cheaper than the browser-verified frontend benchmark
