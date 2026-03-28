# Ralph

<img src="ralph.webp" alt="Ralph" width="50%" />

Ralph is a file-based agent loop for autonomous coding. This fork is tuned for Codex on Windows and is optimized for resumable PRD-driven work rather than one-off chat turns.

## Not Vanilla Ralph

This fork intentionally incorporates ideas learned from GSD and lean-ctx work rather than staying as a stock Ralph loop.

- Windows-first Codex runner behavior, including SDK-backed supervision and quieter helper process handling on Windows
- fresh per-iteration context plus bounded progress, recipe, and strategy memory so longer runs do not decay into context rot
- layered benchmark suites (`smoke`, `quick`, `hourly`, `deep`) backed by deterministic PRD benchmark skills for repeatable tuning
- long-run loop resilience features such as heartbeat output, hang recovery, and built-in local verification paths

Details live in [docs/usage-reference.md](docs/usage-reference.md) and [docs/benchmarking.md](docs/benchmarking.md).

## Quick Start

Install Ralph from GitHub:

```bash
npm i -g github:soolafsen/ralph#main
```

Install the project templates in the repo you want Ralph to work on:

```bash
ralph install
ralph install --skills
```

If that repo already has `.agents/ralph`, the local copy wins. Refresh it with:

```bash
ralph install --force
```

Create a PRD:

```bash
ralph prd "Add a small JSON CLI for parsing and filtering a file"
```

If you already have a `plan.md`, you can often just run:

```bash
ralph prd
```

When you do that, Ralph will look for `cursor-plan.md`, `plan.md`, and `*.plan.md` in the repo root and use one of them before falling back to manual entry.

Or use an existing plan file:

```bash
ralph prd --plan plan.md
```

Run the normal build loop:

```bash
ralph build
```

That is the real default path: Ralph runs up to its default iteration limit and stops early when all stories are done.

Run one build iteration:

```bash
ralph build 1
```

Useful first checks:

```bash
ralph doctor
ralph overview
```

## Build Modes

Most users should start with normal `ralph build`.

- `ralph build`: default mode for normal multi-story Ralph work.
- `ralph build 1`: one focused iteration when you want a smaller pass.
- `ralph build 1 --tiny`: same loop, but with a smaller-task prompt bias for very small work.
- `ralph build --barebones`: most stripped-down loop; defaults to one iteration and avoids extra verification unless the story or quality gates require it.

If `--tiny` and `--barebones` sound close, the short version is:

- `--tiny` keeps the normal loop and only changes how aggressively Ralph stays small.
- `--barebones` is the minimal loop mode.

More detail lives in [docs/usage-reference.md](docs/usage-reference.md).

## Benchmarks

For regular benchmark feedback, start with:

```bash
ralph bench:quick
```

The full benchmark catalog and suite guidance live in [docs/benchmarking.md](docs/benchmarking.md). The hourly suite is now kept as a sub-60-minute layer, with deeper API/process-lifecycle coverage left to the deep suite.

## Docs

- [Usage reference](docs/usage-reference.md)
- [Benchmarking](docs/benchmarking.md)
- [Tuning TODO](docs/tuning-todo.md)

## Notes

- Ralph is tuned for Codex and Windows first.
- `ralph prd` expects the `prd` skill to exist for the agent you are using.
- For tiny one-off edits, direct Codex use can still be cheaper than running a full Ralph loop.

## Local Checks

```bash
npm test
npm run bench:quick
```

## When Ralph Fits

Use Ralph when you want a resumable PRD-driven loop instead of a one-off prompt.

- Good fit: multi-step repo work, benchmarks, iterative cleanup, or changes where you want progress tracked on disk.
- Less useful: tiny one-file edits where a direct pass in your AI editor or agent is faster than creating and running a PRD.
- What to expect: Ralph reads the current repo state each iteration, completes one story at a time, and writes logs and progress under `.ralph/`.
- Why this helps: each iteration starts with fresh on-disk context plus compact learned state, which helps avoid context rot and makes longer unsupervised runs more reliable.
