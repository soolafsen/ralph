# Build

Complete exactly one story from the PRD, verify it, and record the outcome.

## Paths
- Repo Root: {{REPO_ROOT}}
- PRD: {{PRD_PATH}}
- AGENTS (optional): {{AGENTS_PATH}}
- Progress Snapshot: {{PROGRESS_CONTEXT_PATH}}
- Progress Log (append only): {{PROGRESS_PATH}}
- Errors Log: {{ERRORS_LOG_PATH}}
- No-commit: {{NO_COMMIT}}
- Run ID: {{RUN_ID}}
- Iteration: {{ITERATION}}
- Run Log: {{RUN_LOG_PATH}}
- Run Summary: {{RUN_META_PATH}}
- Tiny Task Mode: {{TINY_TASK_MODE}}

## Selected Story
- ID: {{STORY_ID}}
- Title: {{STORY_TITLE}}

{{STORY_BLOCK}}

If the story block is empty, stop and report that the PRD story could not be parsed.

## Global Quality Gates
{{QUALITY_GATES}}

## Rules
- Work only on {{STORY_ID}}.
- Do not ask the user questions.
- Do not edit the PRD JSON directly.
- Read code before changing it.
- Keep changes minimal and relevant.
- If {{NO_COMMIT}} is true, do not commit or push.
- If you discover reusable run/build/test instructions, update {{AGENTS_PATH}} briefly.

## Execution
1. Read the selected story, the global quality gates, and the progress snapshot.
2. Read only the repo files needed for this story. Read {{AGENTS_PATH}} if it exists and is relevant.
3. Implement the story fully. No placeholders unless the story explicitly requires scaffolding.
4. Run the story-specific verification plus the global quality gates that apply.
5. For frontend or UI changes, verify in a browser before marking complete.
6. Append a concise progress entry to {{PROGRESS_PATH}} with what changed, verification results, and any useful follow-up notes.
7. If repeated failures or traps were discovered, log them to {{ERRORS_LOG_PATH}}.
8. Only then output `<promise>COMPLETE</promise>`.

## Progress Entry
Append a short entry in this format:

```text
## [Date/Time] - {{STORY_ID}}: {{STORY_TITLE}}
Run: {{RUN_ID}} (iteration {{ITERATION}})
No-commit: {{NO_COMMIT}}
Verification:
- <command> -> PASS/FAIL
- <command> -> PASS/FAIL
Files changed:
- <file>
- <file>
Outcome:
- <what was implemented>
Notes:
- <useful pattern or gotcha>
---
```

## Tiny Task Mode
If `{{TINY_TASK_MODE}}` is `true`, prefer the shortest solution that satisfies the story and avoid extra scaffolding, audits, or documentation beyond what the story requires.
