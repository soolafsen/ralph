---
name: prdtest04
description: "Deterministic low-token benchmark PRD for a tiny Node CLI text utility. Use when the user asks for prdtest04, a cheap Ralph benchmark, or a very small non-UI PRD to measure overhead and token usage."
---

# PRDTEST04 Node Tiny CLI

Generate a deterministic compact JSON PRD for a very small Node benchmark.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and intentionally small.

## Required Top-Level Values

- `project`: `PRDTEST04 Node Tiny CLI`
- `overview`: Tiny Node command-line utility that reads a text file and prints line, word, and character counts with basic tests and README instructions.
- `qualityGates`:
  - `node src/index.js sample.txt`
  - `npm test`

## Required Assumptions

- Use plain Node.js with JavaScript
- Do not add frameworks or TypeScript
- Keep the program file-based and local-only

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the CLI and sample input`
- Scope:
  - create the Node project shell
  - add an entrypoint and sample text file
  - define output format

### US-002

- Title: `Implement text counting logic`
- Scope:
  - count lines, words, and characters
  - keep logic testable and separate from CLI parsing

### US-003

- Title: `Add tests and README instructions`
- Scope:
  - add basic tests
  - add README with run commands
  - keep verification cheap

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Keep this benchmark intentionally smaller than the others
