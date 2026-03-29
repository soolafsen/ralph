---
name: prdtest06
description: "Deterministic benchmark PRD for a tiny Node JSON transform CLI. Use when the user asks for prdtest06, a cheap JSON/file benchmark, or a small Ralph benchmark that exercises parsing and focused tests."
owner: ralph
scope: project
---

# PRDTEST06 Node JSON Transform CLI

Generate a deterministic compact JSON PRD for a tiny Node CLI benchmark.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and intentionally small.

## Required Top-Level Values

- `project`: `PRDTEST06 Node JSON Transform CLI`
- `overview`: Tiny Node command-line utility that reads a JSON file, filters and normalizes records, writes a derived JSON output file, and includes focused tests and README instructions.
- `qualityGates`:
  - `node src/index.js input.json output.json`
  - `npm test`

## Required Assumptions

- Use plain Node.js with JavaScript
- Do not add frameworks or TypeScript
- Keep the program file-based and local-only

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the JSON transform CLI`
- Scope:
  - create the Node project shell
  - add entrypoint and sample input file
  - define output file format

### US-002

- Title: `Implement JSON filtering and normalization`
- Scope:
  - read input records from JSON
  - filter inactive records
  - normalize output fields in testable logic

### US-003

- Title: `Add tests and README instructions`
- Scope:
  - add focused tests
  - add README with run commands
  - keep verification cheap

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep this benchmark cheap enough for frequent suite use
