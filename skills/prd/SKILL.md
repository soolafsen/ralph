---
name: prd
description: "Generate a compact Product Requirements Document (PRD) as JSON for Ralph. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
owner: ralph
scope: project
---

# PRD Generator (Compact JSON)

Create a compact JSON PRD that Ralph can execute deterministically.

This skill is designed for a one-shot `ralph prd` flow. Do not ask follow-up questions. Make reasonable assumptions, keep the scope tight, and write the PRD in a single pass.

## The Job

1. Read the feature request
2. Infer the smallest reasonable implementation scope
3. Define realistic quality gates
4. Write a compact JSON PRD to the provided path

Important:

- Do not implement anything
- Do not ask the user questions
- Prefer small, reliable stories over broad bundled stories
- Record important uncertainty in `openQuestions`

## Assumption Rules

When the request is vague:

- prefer a new project over assuming a complex existing codebase
- prefer the smallest stack that fits the request
- prefer local-only runtime over hosting unless deployment is requested
- prefer the smallest honest story size for the real scope, not an artificially compressed plan

Always decide:

- new project or existing codebase
- runtime / framework
- quality gates

## Story Sizing

Choose story count based on implementation surface area, not on brevity alone.
Default toward more, smaller stories when the alternative would create long or mixed-scope iterations.

- Small plan: `2-4` stories
- Medium plan: `5-9` stories
- Large plan: `8-14` stories

Use these heuristics:

- Small:
  - one narrow user-visible capability
  - one subsystem or a very small extension to an existing app
  - little or no persistence, background processing, or cross-cutting polish
  - only use `1` story when the task is truly tiny and already naturally atomic
- Medium:
  - several related capabilities or subsystems
  - meaningful state management, persistence, multiple screens, or layered gameplay systems
  - enough scope that collapsing to `2-4` stories would create overloaded iterations
- Large:
  - many subsystems or broad workflow coverage
  - significant persistence, integrations, admin surfaces, gameplay progression, or non-trivial polish
  - enough scope that medium sizing would still leave multiple stories too large for one Ralph iteration

Use plan structure as a clue:

- `1-3` substantive checklist items usually maps to small
- `4-8` substantive checklist items usually maps to medium
- `10+` substantive checklist items usually maps to large

Use subsystem count as a clue:

- `1-2` subsystems usually maps to small
- `3-4` subsystems usually maps to medium
- `5+` subsystems usually maps to large

If the request already provides a plan, preserve its natural decomposition unless it is obviously too coarse or too fragmented.

Prefer splitting when one story would otherwise do two or more of these at once:

- project setup plus core feature delivery
- core behavior plus persistence
- core behavior plus UI polish
- multiple mechanics or subsystems with different verification modes
- implementation plus broad integration hardening

Good Ralph stories are:

- independently verifiable
- narrow enough to retry cheaply
- small enough that progress logs stay informative
- vertical slices where possible, not technical mega-batches

Avoid PRDs where most medium features collapse into only `2-3` stories unless the request is genuinely that small.

## Output Shape

Use this compact JSON shape:

```json
{
  "version": 1,
  "project": "Feature Name",
  "overview": "Short summary",
  "openQuestions": [
    "Assumption or unresolved detail"
  ],
  "qualityGates": [
    "npm test"
  ],
  "stories": [
    {
      "id": "US-001",
      "title": "Short story title",
      "status": "open",
      "dependsOn": [],
      "description": "One or two short lines describing the story",
      "acceptanceCriteria": [
        "Specific criterion",
        "Example: expected success case",
        "Negative case: expected failure case"
      ]
    }
  ]
}
```

## Rules

- Keep top-level fields compact
- Only include extra fields if they are genuinely needed for implementation
- Story IDs must be sequential: `US-001`, `US-002`, ...
- New stories always start as `"open"`
- `dependsOn` must contain IDs only
- Every story must include:
  - a non-empty `description` field
  - a `description` capped to one or two short lines, not a paragraph
  - at least one concrete success example
  - at least one negative case
- If this is a new project, the first story must set up the minimal runnable project
- If a dependency is needed, call it out directly in acceptance criteria
- Keep each story small enough for a single Ralph iteration
- Keep stories vertically sliced and independently verifiable where possible
- Prefer stories that can be completed in one focused pass without mixing scaffolding, gameplay/business logic, persistence, and polish
- Do not combine core mechanics, persistence, and polish in one story unless the task is genuinely tiny
- Do not combine feature delivery and final verification into the same story unless the scope is small
- Split stories when a single story would otherwise introduce multiple subsystems plus cross-cutting concerns

## Quality Gates

Always define quality gates.

Use the lightest realistic defaults:

- Node CLI/app: `npm run start`, plus `npm test` if tests are included
- Python script/app: run command, plus `pytest` only if tests are included
- Shell script: run verification, plus a syntax check if appropriate

Do not invent heavyweight build pipelines unless the request clearly needs them.

## Output Requirements

- Save the PRD JSON to the exact path provided
- If only a directory is provided, choose `prd-<short-slug>.json`
- Write only JSON to the file

After saving, tell the user:

`PRD JSON saved to <path>. Close this chat and run \`ralph build\`.`
