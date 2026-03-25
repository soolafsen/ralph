---
name: prd
description: "Generate a compact Product Requirements Document (PRD) as JSON for Ralph. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
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
- Prefer fewer stories, fewer dependencies, and less ceremony
- Record important uncertainty in `openQuestions`

## Assumption Rules

When the request is vague:

- prefer a new project over assuming a complex existing codebase
- prefer the smallest stack that fits the request
- prefer local-only runtime over hosting unless deployment is requested
- prefer 1-3 stories total when possible

Always decide:

- new project or existing codebase
- runtime / framework
- quality gates

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
      "description": "Short story description",
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
  - at least one concrete success example
  - at least one negative case
- If this is a new project, the first story must set up the minimal runnable project
- If a dependency is needed, call it out directly in acceptance criteria
- Keep each story small enough for a single Ralph iteration

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
