---
name: prdtest08
description: "Deterministic benchmark PRD for a tiny Python utility library with pytest. Use when the user asks for prdtest08, a cheap Python library benchmark, or a small non-CLI Ralph benchmark."
---

# PRDTEST08 Python Tiny Library

Generate a deterministic compact JSON PRD for a tiny Python library benchmark.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and intentionally small.

## Required Top-Level Values

- `project`: `PRDTEST08 Python Tiny Library`
- `overview`: Small Python utility library with a few pure helper functions, focused pytest coverage, and brief README usage instructions.
- `qualityGates`:
  - `pytest`

## Required Assumptions

- Use plain Python
- Keep the code as a small importable library, not a server or UI app
- Keep dependencies minimal

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the Python package`
- Scope:
  - create the package structure
  - add the library entrypoint
  - define exported function behavior

### US-002

- Title: `Implement the pure helper functions`
- Scope:
  - implement deterministic helpers
  - keep the logic directly testable and side-effect free

### US-003

- Title: `Add pytest coverage and README usage`
- Scope:
  - add focused pytest tests
  - add minimal README examples
  - keep verification cheap

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep this benchmark cheap enough for regular suite use
