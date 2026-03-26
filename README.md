# Ralph

![Ralph](ralph.webp)

Ralph is a file-based agent loop for autonomous coding. This fork is tuned specifically for **Codex**, **Windows**, and **Git Bash**.

The main goals of this fork are:

- work reliably with `codex exec`
- run cleanly from Windows while invoking Git Bash for the shell loop
- use slimmer prompts and less repeated context per iteration
- keep the loop autonomous without dragging full chat history forward

## What This Fork Changes

Compared with the upstream Ralph flow, this fork adds or changes:

- Windows launcher fixes so `.sh` loop scripts run through **Git Bash** instead of accidentally picking up WSL `bash`
- Codex PRD fixes so `ralph prd` uses a one-shot `codex exec` path instead of interactive prompt injection
- slimmer build prompts with a compact progress snapshot instead of feeding large context every run
- compact bundled PRD generation so build runs carry less narrative overhead
- automatic stale story recovery defaults
- automatic tiny-task prompting for very small PRDs
- an explicit `--tiny` flag for build runs
- ASCII-safe loop banners for cleaner Windows terminal output

## Recommended Environment

This fork is tuned for:

- Windows 11
- PowerShell or `cmd.exe` as the outer shell
- Git for Windows installed
- Git Bash available at a standard Git install path
- Codex CLI installed globally
- Python available as both `python` and `python3` inside Git Bash

If your system resolves `bash` to WSL first, that is fine: Ralph will prefer Git Bash on Windows when launching the loop.

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

## Quiet Mode

Use `--quiet` when you want a short progress view in the terminal while keeping full logs on disk.

Quiet mode is intended to show only major stage changes, for example:

- PRD started / completed
- build iteration started
- story completed / failed / incomplete
- remaining story count
- log file path

The detailed agent output still goes to `.ralph/runs/`.

The quiet heartbeat is now based on actual run-log activity:

- `.` means the run log grew since the last check
- `[idle 30s]`, `[idle 60s]`, and so on mean the process is still alive but the log has not changed for that long
- quiet mode warns when a run is idle for a long time or when a completion marker appears but the process does not unwind

That makes quiet mode a better liveness signal without pretending stalled output is active progress.

If you interrupt a suspected hang:

- Ralph marks the story `done` if the run log already contains `<promise>COMPLETE</promise>`
- otherwise Ralph resets the story to `open`

That allows a cleaner restart without waiting for stale-story recovery.

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

## Windows Notes

Important Windows-specific behavior in this fork:

- the loop script is launched through **Git Bash**
- Windows paths are converted before being passed into Bash
- shell scripts are normalized to LF in the repo
- the loop banner uses ASCII output to avoid mojibake in Windows terminals

If `ralph build` says Python is missing even though `python` works in PowerShell, check Git Bash:

```bash
python3 --version
command -v python3
```

Ralph's shell loop uses `python3`, so that command must resolve inside Git Bash.

## State Files

Ralph writes loop state to `.ralph/`:

- `progress.md`
- `activity.log`
- `errors.log`
- `runs/`

Templates live in `.agents/ralph/`.

PRDs live in `.agents/tasks/`.

## Notes

- This fork is intentionally optimized for the Codex + Windows + Git Bash workflow, not for being perfectly generic across every shell and agent combination.
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
