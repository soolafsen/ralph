# Ralph

![Ralph](ralph.webp)

Ralph is a file-based agent loop for autonomous coding. This fork is tuned specifically for **Codex** and **Windows**, with Git Bash kept for helper workflows rather than the main Windows supervisor path.

The main goals of this fork are:

- work reliably with `codex exec`
- run cleanly from Windows with a native supervisor around long-running agent work
- use slimmer prompts and less repeated context per iteration
- keep the loop autonomous without dragging full chat history forward

## What This Fork Changes

Compared with the upstream Ralph flow, this fork adds or changes:

- Windows-native build and PRD supervision so Ralph can recover control even when agent output lingers after completion
- a Windows-first Codex SDK backend that prefers structured turn events over raw log/session scraping, with automatic CLI fallback
- first-class helper scripts for local browser verification and hidden Windows process handling
- Bash fallback handling for helper scripts and compatibility paths
- Codex PRD fixes so `ralph prd` uses a one-shot `codex exec` path instead of interactive prompt injection
- slimmer build prompts with a compact progress snapshot instead of feeding large context every run
- compact bundled PRD generation so build runs carry less narrative overhead
- compact progress snapshots and per-run metrics so prompt growth and hot spots are visible
- automatic stale story recovery defaults
- automatic tiny-task prompting for very small PRDs
- an explicit `--tiny` flag for build runs
- ASCII-safe loop banners for cleaner Windows terminal output

## Recommended Environment

This fork is tuned for:

- Windows 11
- PowerShell or `cmd.exe` as the outer shell
- Git for Windows installed
- Git Bash available if you use Bash-specific helper scripts
- Codex CLI installed globally
- Python available in Windows if your repo workflow needs it

## Install

`@soolafsen/ralph` is not currently published on the npm registry.

Install it directly from this GitHub repository:

```bash
npm i -g github:soolafsen/ralph#main
```

If you already have an older global install, refresh it with:

```bash
npm uninstall -g @soolafsen/ralph
npm i -g github:soolafsen/ralph#main
```

If a repo already contains `.agents/ralph`, that local template copy overrides the bundled global install for that repo. After upgrading the global CLI, either remove the local override or refresh it:

```bash
rmdir /s /q .agents\ralph
```

or:

```bash
ralph install --force
```

## Project Setup

Install local templates into the current project:

```bash
ralph install
```

Install skills:

```bash
ralph install --skills
```

If you use the global Ralph install, install skills for the same agent scope you actually use. For Codex, the `prd` skill must exist before `ralph prd` can generate PRDs reliably.

Reinstall bundled skills even if they already exist:

```bash
ralph install --skills --force-skills
```

The main skills are:

- `prd`
- `commit`
- `dev-browser`
- `prdtest01`
- `prdtest02`
- `prdtest03`
- `prdtest04`
- `prdtest05`

The `prdtestNN` skills are fixed benchmark PRD generators. They let you recreate recognizable test PRDs on demand instead of keeping old PRD JSON files around.

Examples:

```bash
ralph prd 'Use $prdtest01'
ralph prd 'Use $prdtest02'
ralph prd 'Use $prdtest03'
ralph prd 'Use $prdtest04'
ralph prd 'Use $prdtest05'
```

In PowerShell, use single quotes around skill triggers like `$prdtest01` so PowerShell does not expand them before Ralph sees the literal skill name.

Benchmark meanings:

- `prdtest01`: small React frontend benchmark
- `prdtest02`: small Python CLI benchmark
- `prdtest03`: small C# in-memory CRUD benchmark
- `prdtest04`: intentionally cheap Node CLI benchmark for token and overhead checks
- `prdtest05`: lightweight Node API benchmark for startup, run-instruction, and process-lifecycle checks

Benchmark suites:

- `quick`: `prdtest04`, `prdtest02`
- `deep`: `prdtest04`, `prdtest02`, `prdtest05`, `prdtest03`, `prdtest01`

The `quick` suite is for fast feedback after Ralph changes and is intended to stay under roughly 20 minutes. The `deep` suite is for broader confidence before merging meaningful workflow changes and is intended to stay within roughly 2-3 hours.

Benchmark history in this repo uses **price-ish tokens** as the primary metric:

- `price-ish = uncached input + output + reasoning`
- cached input is stored separately as prompt reuse detail
- raw input is stored separately as prompt footprint detail

For local app verification during Ralph build runs, the bundled Ralph browser helper is now preferred over the persistent `dev-browser` relay server. The main path is a single `serve-and-run` helper call that starts the dev server, runs the headless Playwright check, and then tears the server down. The relay skill remains useful for remote or session-dependent websites.

## How Ralph Works

Ralph treats files and git state as memory:

- the **PRD JSON** defines stories, dependencies, and quality gates
- the **loop** selects one story per iteration
- status and run logs are written to `.ralph/`

Each build iteration starts fresh, reads the current on-disk state, completes one story, and then exits or moves to the next story depending on your iteration count.

![Ralph architecture](diagram.svg)

## Quick Start

Create a PRD:

```bash
ralph prd
```

Use an existing plan file directly:

```bash
ralph prd --plan cursor-plan.md
ralph prd --plan plan.md
ralph prd --plan print_foo_greenfield.plan.md
```

This fork expects the `prd` skill to work in a **one-shot** flow. The recommended skill behavior is:

- do not ask follow-up questions
- make reasonable assumptions
- write a deterministic and compact JSON PRD in one run

If you run `ralph prd` with no inline request and no `--plan`, Ralph will look for:

- `cursor-plan.md`
- `plan.md`
- any `*.plan.md` file in the current repo root

If one or more of those files exist in the current repo, Ralph will offer to use one of them before falling back to manual entry.

If no plan files are found, Ralph now prints the working directory and the exact search patterns it checked.

Run one iteration:

```bash
ralph build 1
```

Run without commits:

```bash
ralph build 1 --no-commit
```

Run with terse terminal output:

```bash
ralph prd --quiet
ralph build 1 --quiet
```

Allow visible browser windows for frontend verification:

```bash
ralph build 1 --show-browser
```

Force tiny-task mode:

```bash
ralph build 1 --tiny
```

Run a minimal barebones loop:

```bash
ralph build --barebones
```

Choose a PRD explicitly:

```bash
ralph build 1 --prd .agents/tasks/prd-api.json
```

Override the progress log:

```bash
ralph build 1 --progress .ralph/progress-api.md
```

Generate a quick overview from an existing PRD:

```bash
ralph overview
```

Check local prerequisites:

```bash
ralph doctor
```

`ralph doctor` now also reports:

- whether the `prd` skill exists for Codex in local or global skill locations
- whether local templates are overriding bundled global templates
- which plan files, if any, were detected in the current working directory
- whether Ralph's built-in browser checker dependency is installed
- whether `@openai/codex-sdk` is available
- which Codex backend Ralph would select on this machine
- why `auto` would fall back to the legacy CLI path

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

Tiny-task mode does not change the loop structure. It changes the prompt guidance so Codex prefers the shortest valid implementation and avoids unnecessary scaffolding or ceremony.

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

You can enable it with:

```bash
ralph build --barebones
ralph build 3 --barebones
```

Practical effects of `--barebones`:

- defaults build runs to one iteration unless you pass an explicit iteration count
- biases the agent toward the smallest viable story implementation
- avoids tests, browser checks, package installs, and README churn unless the story or quality gates actually require them
- keeps the loop file-based and story-based like normal Ralph

What `--barebones` does not do:

- it does not bypass PRD story selection
- it does not ignore explicit quality gates
- it does not change `--no-commit` behavior
- it does not prevent you from running multiple iterations when you ask for them

## Quiet Mode

Use `--quiet` when you want a short progress view in the terminal while keeping full logs on disk.

Quiet mode is intended to show only major stage changes, for example:

- PRD started / completed
- build iteration started
- story completed / failed / incomplete
- remaining story count
- log file path
- per-step token totals and cumulative token totals when available
- per-step token breakdown when Codex session data is available: input, cached input, output, and reasoning output
- end-of-run install or startup commands when Ralph can infer them

The detailed agent output still goes to `.ralph/runs/`.

The quiet heartbeat is now based on actual run-log activity:

- `.` means the run log grew since the last check
- each quiet-mode status line is prefixed with a 24-hour timestamp like `[19:27:32]`
- `[thinking 30s]`, `[thinking 60s]`, and so on mean the process is still alive but the log has not changed for that long
- quiet mode warns when a run is quiet for a long time or when a completion marker appears but the process does not unwind

That makes quiet mode a better liveness signal without pretending stalled output is active progress.

If the agent does not emit a `<run_instructions>` block, Ralph falls back to the essentials it can infer from:

- `AGENTS.md`
- `README.md`
- `package.json` scripts

If you interrupt a suspected hang:

- Ralph offers a small interrupt menu
- if the run log already contains `<promise>COMPLETE</promise>`, the default action is to mark the story `done` and continue
- otherwise the default action is to reset the story to `open` and retry automatically
- you can also choose to kill and exit without continuing the run

That allows a cleaner recovery without retyping the Ralph command.

## Browser Visibility

For frontend or UI stories, Ralph still expects browser verification by default.

By default, this fork now guides the agent to prefer headless browser verification so multi-iteration runs do not keep opening visible tabs or windows.

If you do want a real browser window during those checks, use:

```bash
ralph build 1 --show-browser
```

What `--show-browser` means:

- it allows visible browser windows or tabs during frontend verification
- it is intended for manual inspection, demos, or debugging browser-specific issues

What `--show-browser` does not mean:

- it does not disable browser verification
- it does not force browser verification for non-frontend stories
- it does not change quiet mode, iteration count, or commit behavior

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

By default, Ralph now sets Codex `model_reasoning_effort` to `medium` for its bundled Codex commands. That keeps the default build loop from inheriting a globally configured `high` effort setting unless you explicitly override the agent command.

You can override the Codex backend selection with:

```bash
set RALPH_CODEX_BACKEND=auto
set RALPH_CODEX_BACKEND=sdk
set RALPH_CODEX_BACKEND=cli
```

Backend meanings:

- `auto`: prefer the SDK on Windows for Codex, then fall back to the legacy CLI path if the SDK is unavailable
- `sdk`: require the SDK path and fail clearly if it cannot be loaded
- `cli`: force the legacy `codex exec` orchestration path

## Windows Notes

Important Windows-specific behavior in this fork:

- `ralph build` and `ralph prd` use a native Node supervisor on Windows
- on Windows with Codex, Ralph now prefers `@openai/codex-sdk` for structured events, token usage, and cancellation
- if the SDK cannot be used and `RALPH_CODEX_BACKEND=auto`, Ralph falls back to the legacy CLI path and records the fallback
- the supervisor watches for `<promise>COMPLETE</promise>` and can terminate lingering child trees after a short grace period
- local frontend checks should use Ralph's direct Playwright helper in one-shot `serve-and-run` mode by default, not the persistent `dev-browser` relay
- hidden long-running server helpers still exist, but they are secondary to the one-shot verification path for Codex on Windows
- shell scripts are normalized to LF in the repo
- the loop banner uses ASCII output to avoid mojibake in Windows terminals

If you are using Bash-specific helpers and `python3` is missing there, check Git Bash:

```bash
python3 --version
command -v python3
```

That check is now optional for the main Windows runner.

## State Files

Ralph writes loop state to `.ralph/`:

- `progress.md`
- `activity.log`
- `errors.log`
- `runs/`

Templates live in `.agents/ralph/`.

PRDs live in `.agents/tasks/`.

## Notes

- This fork is intentionally optimized for the Codex + Windows workflow, not for being perfectly generic across every shell and agent combination.
- The build prompt is slimmer than upstream and passes less repeated context per iteration.
- For tiny one-off changes, direct Codex use may still be cheaper than Ralph.
- Ralph makes the most sense for structured multi-step work where resumable state is useful.

## Future Direction

- [Multi-agent outline](docs/multi-agent-outline.md): a staged path from the current single-agent loop toward controlled multi-agent orchestration.

## Tests

Dry-run smoke tests:

```bash
npm test
```

Minimal agent ping:

```bash
npm run test:ping
```

Real-agent loop test:

```bash
npm run test:real
```

Analyze a Ralph run from a real project:

```bash
npm run benchmark:run -- C:\path\to\project
```

Record a benchmark run into benchmark history:

```bash
npm run benchmark:record -- --benchmark prdtest04 C:\path\to\project
```

Compare history for one benchmark:

```bash
npm run benchmark:compare -- --benchmark prdtest04
```

Compare the latest results for a benchmark suite:

```bash
npm run benchmark:suite -- --suite quick
npm run benchmark:suite -- --suite deep
```

Run the benchmark suites end-to-end:

```bash
ralph bench:quick
ralph bench:deep
```

Benchmark notes and suite definitions live in:

- `benchmarks/definitions.json`
- `benchmarks/README.md`
