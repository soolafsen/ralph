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

Install directly from this fork:

```bash
npm i -g github:soolafsen/ralph#main
```

To test the slimmer branch specifically:

```bash
npm i -g github:soolafsen/ralph#slimline
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

This fork expects the `prd` skill to work in a **one-shot** flow. The recommended skill behavior is:

- do not ask follow-up questions
- make reasonable assumptions
- write a deterministic JSON PRD in one run

Run one iteration:

```bash
ralph build 1
```

Run without commits:

```bash
ralph build 1 --no-commit
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
