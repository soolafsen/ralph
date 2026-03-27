---
name: prdtest07
description: "Deterministic benchmark PRD for a tiny Node utility library with tests. Use when the user asks for prdtest07, a tiny library benchmark, or a very cheap non-CLI/non-server Ralph benchmark."
---

# PRDTEST07 Node Tiny Library

Generate a deterministic compact JSON PRD for a tiny Node library benchmark.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and intentionally small.

## Required Top-Level Values

- `project`: `PRDTEST07 Node Tiny Library`
- `overview`: Small Node utility library that exports pure string helper functions, includes focused tests, and adds minimal README usage instructions.
- `qualityGates`:
  - `npm test`

## Required Assumptions

- Use plain Node.js with JavaScript
- Do not add frameworks or TypeScript
- Keep the code as a small importable library, not a server or browser app

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the library module`
- Scope:
  - create the Node project shell
  - add the library entrypoint
  - define exported function names and expected behavior

### US-002

- Title: `Implement the pure helper functions`
- Scope:
  - implement a few deterministic string helpers
  - keep the logic pure and directly testable

### US-003

- Title: `Add tests and README usage`
- Scope:
  - add focused unit tests
  - add minimal README examples
  - keep verification cheap

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep this benchmark intentionally tiny to expose loop overhead
