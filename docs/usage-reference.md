# Usage Reference

This page holds the detailed runtime and mode reference that does not need to stay on the landing README.

## Tiny Task Mode

Tiny-task mode is designed for very small stories where the original Ralph prompt overhead is wasteful.

By default, tiny-task mode is enabled automatically for small PRDs. In this fork, the threshold is controlled by:

```sh
TINY_TASK_STORY_MAX=3
```

You can also force it explicitly with:

```bash
ralph build 1 --tiny
```

Practical effects of `--tiny`:

- biases Codex toward the shortest valid implementation
- reduces unnecessary scaffolding, ceremony, and extra documentation
- skips progress snapshot context in the slimmer loop path
- helps keep trivial tasks from getting over-engineered

What `--tiny` does not do:

- it does not change iteration count
- it does not skip verification
- it does not bypass PRD story selection
- it does not change git or `--no-commit` behavior
- it does not reduce story count inside the PRD automatically

## Barebones Mode

Barebones mode is for the simplest possible Ralph loop when you want a minimal implementation pass and the lightest acceptable verification.

Enable it with:

```bash
ralph build --barebones
ralph build 3 --barebones
```

Practical effects of `--barebones`:

- defaults build runs to one iteration unless you pass an explicit iteration count
- biases the agent toward the smallest viable story implementation
- avoids tests, browser checks, package installs, and README churn unless the story or quality gates actually require them
- keeps the loop file-based and story-based like normal Ralph

## Quiet Mode

Use `--quiet` when you want a short progress view in the terminal while keeping full logs on disk.

Quiet mode shows major stage changes such as:

- PRD started or completed
- build iteration started
- story completed, failed, or incomplete
- remaining story count
- log file path
- per-step token totals and cumulative token totals when available

The detailed agent output still goes to `.ralph/runs/`.

Quiet mode now uses actual run-log activity:

- `.` means the run log grew since the last check
- each quiet-mode line is prefixed with a 24-hour timestamp
- `[thinking 30s]`, `[thinking 60s]`, and so on mean the process is still alive but the log has not changed for that long
- quiet mode warns when a run is quiet for a long time or when a completion marker appears but the process does not unwind

## Browser Visibility

For frontend or UI stories, Ralph still expects browser verification by default.

By default this fork prefers headless browser verification so multi-iteration runs do not keep opening visible windows.

If you want a real browser window during those checks, use:

```bash
ralph build 1 --show-browser
```

## Stale Story Recovery

If a run crashes after a story is marked `in_progress`, Ralph can reopen it automatically.

This fork defaults to:

```sh
STALE_SECONDS=300
```

That means stories stuck in `in_progress` for more than 5 minutes are reopened automatically on the next loop run.

## Agent Runner

This fork is tuned for Codex first, but the agent map still supports:

- `codex`
- `claude`
- `droid`
- `opencode`

Example:

```bash
ralph prd --agent=codex
ralph build 1 --agent=codex
```

The Codex defaults in this fork use `codex exec`.

You can override the Codex backend selection with:

```bash
set RALPH_CODEX_BACKEND=auto
set RALPH_CODEX_BACKEND=sdk
set RALPH_CODEX_BACKEND=cli
```

## Windows Notes

Important Windows-specific behavior in this fork:

- `ralph build` and `ralph prd` use a native Node supervisor on Windows
- on Windows with Codex, Ralph prefers `@openai/codex-sdk` for structured events, token usage, and cancellation
- if the SDK cannot be used and `RALPH_CODEX_BACKEND=auto`, Ralph falls back to the legacy CLI path and records the fallback
- the supervisor watches for `<promise>COMPLETE</promise>` and can terminate lingering child trees after a short grace period
- local frontend checks should use Ralph's direct Playwright helper in one-shot `serve-and-run` mode by default

## State Files

Ralph writes loop state to `.ralph/`:

- `progress.md`
- `activity.log`
- `errors.log`
- `runs/`

Templates live in `.agents/ralph/`.

PRDs live in `.agents/tasks/`.
