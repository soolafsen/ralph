# Usage Reference

This page holds the detailed runtime and mode reference that does not need to stay on the landing README.

## How Ralph Works

Ralph is a file-based, single-agent loop.

- a PRD defines the stories, gates, and status Ralph works through
- each `ralph build` iteration picks one story and advances it
- loop state, logs, and run history live under `.ralph/`
- each new iteration starts from the current repo plus compact on-disk learned state rather than one long chat context

## Backpressure And AGENTS

Ralph works better when the repo pushes back clearly.

- strong checks such as tests, typechecks, lint, and browser verification help Ralph tell the difference between "changed files" and "actually done"
- good backpressure keeps the loop honest and reduces fake progress on longer runs
- keep `AGENTS.md` short and operational: setup, run, test, verify, and repo-specific gotchas
- do not turn `AGENTS.md` into a progress diary; progress belongs in the PRD, `.ralph/`, and run logs

## Mode Chooser

Use normal `ralph build` unless you have a clear reason not to.

- Default build: use for most PRD-driven multi-story work.
- `--no-commit`: useful for short-lived test runs when you want a real loop pass without creating a commit.
- `--tiny`: use when the work is genuinely very small and you want Ralph to stay compact without changing the normal loop shape.
- `--barebones`: use when you want the most stripped-down loop and the lightest acceptable verification path.

Short version:

- `--tiny` changes prompt behavior.
- `--barebones` changes loop behavior.

## GSD And Lean-ctx Influence

This fork is not trying to be a stock Ralph experience.

The main design choices borrowed and adapted here are:

- GSD-style fresh execution from explicit on-disk state instead of relying on ever-growing conversational context
- purpose-specific memory files for progress, recipes, and strategy, rather than one large blob of persistent context
- lean-ctx-style prompt discipline, where injected memory is capped and trimmed so longer runs stay coherent
- inspectable learned state that can help later iterations without silently bloating every prompt

The goal is simple: keep Ralph useful on longer unsupervised runs without paying the usual context-rot penalty.

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
- helps keep trivial tasks from getting over-engineered while preserving the normal Ralph loop

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
- keeps the loop file-based and story-based, but with a more aggressively minimal execution path

## Install And Upgrade Notes

Ralph can run from bundled defaults or from a repo-local `.agents/ralph` copy.

- if a repo contains `.agents/ralph`, that local copy overrides the bundled global install for that repo
- after upgrading the global CLI, run `ralph install --force` in repos that should pick up the refreshed local templates
- `ralph install --skills` installs the bundled skills for the agent scope you choose
- for Codex, the `prd` skill must exist before `ralph prd` can generate PRDs reliably

## Output Mode

Terse progress output is now the default for `ralph prd` and `ralph build`.

Use `--verbose` when you want the full live agent output in the terminal instead of the default terse view.

`--quiet` still works, but is now only a compatibility alias for the default behavior.

The default terse mode shows major stage changes such as:

- PRD started or completed
- build iteration started
- selected build story plus its one- or two-line short description before the heartbeat
- story completed, failed, or incomplete
- remaining story count
- log file path
- per-step token totals and cumulative token totals when available

The detailed agent output still goes to `.ralph/runs/`.

The terse mode uses actual run-log activity:

- `.` means the run log grew since the last check
- each quiet-mode line is prefixed with a 24-hour timestamp
- `[thinking 30s]`, `[thinking 60s]`, and so on mean the process is still alive but the log has not changed for that long
- it warns when a run is quiet for a long time or when a completion marker appears but the process does not unwind

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

## Context Budgets

This fork now applies byte caps to the injected loop context blocks so recipe, strategy, and progress memory do not grow unchecked across iterations.

Defaults:

```sh
PROGRESS_CONTEXT_MAX_BYTES=1600
RECIPES_CONTEXT_MAX_BYTES=1200
STRATEGY_CONTEXT_MAX_BYTES=700
RECIPES_CONTEXT_MAX_COUNT=3
RECIPE_CONTEXT_MAX_STEPS=2
STRATEGY_CONTEXT_MIN_SAMPLES=2
```

Practical effects:

- progress snapshots are trimmed to a fixed byte budget instead of expanding with the full log tail
- recipe injection keeps only the top-ranked trusted recipes and only the first few steps from each one
- strategy memory stays out of prompts until it has at least a small amount of evidence
- trimmed snapshots include a short note when Ralph had to cut context to fit budget
