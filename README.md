# Ralph

![Ralph](ralph.webp)

Ralph is a file-based agent loop for autonomous coding. This fork is tuned specifically for **Codex** and **Windows**, with Git Bash kept for helper workflows rather than the main Windows supervisor path.

The main goals of this fork are:

- work reliably with `codex exec`
- run cleanly from Windows with a native supervisor around long-running agent work
- use slimmer prompts and less repeated context per iteration
- keep the loop autonomous without dragging full chat history forward

## Docs

- [Benchmark suites and benchmark IDs](docs/benchmarking.md)
- [Tuning TODO](docs/tuning-todo.md)
- [Advanced usage and runtime reference](docs/usage-reference.md)
- [Ralph improvement ideas](docs/ralph-improvement-ideas.md)

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
- `prdtest06`
- `prdtest07`
- `prdtest08`
- `prdtest09`

The benchmark PRD skills still use the stable internal `prdtestNN` names, but the benchmark suite and history use clearer workload-oriented IDs. The short version:

- `smoke` is the few-minute sanity suite
- `quick` is the regular roughly-30-minute suite
- `hourly` broadens coverage without going full deep
- `deep` is the broadest pre-merge confidence suite

Run them with:

```bash
ralph bench:smoke
ralph bench:quick
ralph bench:hourly
ralph bench:deep
```

Benchmark details and benchmark IDs live in [docs/benchmarking.md](docs/benchmarking.md).

Examples:

```bash
ralph prd 'Use $prdtest07'
ralph prd 'Use $prdtest06'
ralph prd 'Use $prdtest04'
ralph prd 'Use $prdtest02'
```

In PowerShell, use single quotes around skill triggers like `$prdtest07` so PowerShell does not expand them before Ralph sees the literal skill name.

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

For advanced mode behavior and runtime details, see [docs/usage-reference.md](docs/usage-reference.md).

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
npm run benchmark:record -- --benchmark quick-node-cli C:\path\to\project
```

Compare history for one benchmark:

```bash
npm run benchmark:compare -- --benchmark quick-node-cli
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
