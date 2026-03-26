# Build

Complete exactly one PRD story, verify it, log the result, then stop.

## Paths
- Repo Root: {{REPO_ROOT}}
- PRD: {{PRD_PATH}}
- AGENTS (optional): {{AGENTS_PATH}}
- Progress Snapshot: {{PROGRESS_CONTEXT_PATH}}
- Progress Log: {{PROGRESS_PATH}}
- Errors Log: {{ERRORS_LOG_PATH}}
- Run ID: {{RUN_ID}}
- Iteration: {{ITERATION}}
- Run Log: {{RUN_LOG_PATH}}
- Run Summary: {{RUN_META_PATH}}
- Temp Dir: {{TMP_DIR}}
- No-commit: {{NO_COMMIT}}
- Tiny Task Mode: {{TINY_TASK_MODE}}
- Browser Visibility: {{BROWSER_VISIBILITY}}
- Process Helper: {{PROCESS_HELPER_PATH}}
- Browser Check Helper: {{BROWSER_CHECK_HELPER_PATH}}

## Story
- ID: {{STORY_ID}}
- Title: {{STORY_TITLE}}

{{STORY_BLOCK}}

If the story block is empty, stop and report that the story could not be parsed.

## Quality Gates
{{QUALITY_GATES}}

## Rules
- Work only on {{STORY_ID}}.
- Do not ask the user questions.
- Do not edit the PRD JSON directly.
- Read only the files needed for this story.
- Keep changes minimal and relevant.
- If {{NO_COMMIT}} is true, do not commit or push.
- Update {{AGENTS_PATH}} or `README.md` only when run/build/test instructions are missing or changed.
- Keep run instructions shell-neutral when possible.
- Prefer the cheapest verification that actually proves the story.
- During development, prefer targeted tests or focused checks over broad full-suite reruns.
- Before finishing, run the smallest final verification set that covers the changed behavior and any applicable quality gates.
- For frontend or UI changes, verify in a browser. Prefer headless checks unless Browser Visibility is `show`.
- On Codex + Windows, do not use `cmd /c start`, `start /min`, `Start-Process`, or ad hoc detached shell tricks for local app verification.
- Prefer one-shot browser verification through:
  `node "{{BROWSER_CHECK_HELPER_PATH}}" serve-and-run --cwd "{{REPO_ROOT}}" --url http://127.0.0.1:4173/ --ready-url http://127.0.0.1:4173/ --script "{{TMP_DIR}}/verify-{{STORY_ID}}.mjs" -- npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`
- Use the persistent `dev-browser` relay only for remote or session-dependent websites, not local smoke tests.
- If the repo has a runnable workflow, end your final response with a compact `<run_instructions>` block: one command or next step per line.
- Only output `<promise>COMPLETE</promise>` after the story is implemented, verified, and logged.

## Execution
1. Read the story, quality gates, progress snapshot, and any repo files needed for this story.
2. Implement the story fully. No placeholders unless the story explicitly calls for scaffolding.
3. If the repo lacks clear quick-start commands, add or refresh a short `README.md` before finishing.
4. Run the final verification set.
5. Append a concise progress entry to {{PROGRESS_PATH}} with what changed, what passed, and any useful follow-up notes.
6. Log repeated traps or failures to {{ERRORS_LOG_PATH}}.
7. Output `<promise>COMPLETE</promise>`.

## Progress Entry
```text
## [Date/Time] - {{STORY_ID}}: {{STORY_TITLE}}
Run: {{RUN_ID}} (iteration {{ITERATION}})
No-commit: {{NO_COMMIT}}
Verification:
- <command> -> PASS/FAIL
Files changed:
- <file>
Outcome:
- <what was implemented>
Notes:
- <useful pattern or gotcha>
---
```

## Tiny Task Mode
If `{{TINY_TASK_MODE}}` is `true`, use the shortest solution that satisfies the story and avoid extra scaffolding, broad audits, or documentation churn.
