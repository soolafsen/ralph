---
name: prdtest01
description: "Deterministic benchmark PRD for a simple React hello-world webapp with intentional styling and light interaction. Use when the user asks for prdtest01, a React benchmark PRD, or a recognizable small frontend PRD for Ralph testing."
owner: ralph
scope: project
---

# PRDTEST01 React Styled Hello

Generate a deterministic compact JSON PRD for a small React benchmark app.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and recognizable.

## Required Top-Level Values

- `project`: `PRDTEST01 React Styled Hello`
- `overview`: React + Vite webapp that renders a styled hello-world page with one lightweight interaction and basic automated verification.
- `qualityGates`:
  - `npm run build`
  - `npm test`

## Required Assumptions

- Use Vite with React and plain CSS
- Use JavaScript, not TypeScript
- Keep the app to a single page
- Do not add backend, routing, authentication, or persistence

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the React hello-world app shell`
- Scope:
  - create the Vite React project
  - render a single-page hello-world layout
  - add a styled container and headline
- Acceptance must include:
  - success example for the page rendering without startup errors
  - negative case for missing runtime state or blank screen behavior

### US-002

- Title: `Add styling and one lightweight interaction`
- Scope:
  - add intentional styling beyond defaults
  - add one small interaction such as theme toggle, greeting toggle, or accent switch
  - keep it local-only with no persistence
- Acceptance must include:
  - success example for the interaction visibly changing the UI
  - negative case for interaction not breaking layout or text readability

### US-003

- Title: `Add verification and usage instructions`
- Scope:
  - add at least one React test
  - expose `npm test`
  - add or refresh README with install and run steps
- Acceptance must include:
  - success example for tests passing
  - negative case for the app still building and testing without manual browser setup

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Do not broaden the scope beyond a small frontend benchmark
