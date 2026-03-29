---
name: prdtest05
description: "Deterministic benchmark PRD for a small Node HTTP API with an in-memory store. Use when the user asks for prdtest05, a process-lifecycle benchmark, or a lightweight server PRD to test Ralph stability and run instructions."
owner: ralph
scope: project
---

# PRDTEST05 Node Tiny API

Generate a deterministic compact JSON PRD for a small server benchmark.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and recognizable.

## Required Top-Level Values

- `project`: `PRDTEST05 Node Tiny API`
- `overview`: Small Node HTTP API with an in-memory notes store, basic CRUD-style endpoints, tests, and clear run instructions.
- `qualityGates`:
  - `npm test`
  - `npm run start`

## Required Assumptions

- Use Node.js with a lightweight server stack
- Keep data in memory only
- Do not add a real database, auth, or frontend

## Required Story Plan

Create exactly 4 stories.

### US-001

- Title: `Scaffold the API project shell`
- Scope:
  - create the Node project
  - add a server entrypoint
  - add a health endpoint

### US-002

- Title: `Implement the in-memory notes store`
- Scope:
  - add create and list operations
  - keep repository logic separate from route handlers

### US-003

- Title: `Add read and update endpoints`
- Scope:
  - add item lookup and update behavior
  - keep error handling simple and deterministic

### US-004

- Title: `Add tests and README run instructions`
- Scope:
  - add API tests
  - expose start/test commands
  - add README instructions that Ralph can print back at the end of a run

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep the benchmark focused on lightweight server behavior and process startup
