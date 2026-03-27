# Ralph

Ralph is a file-based agent loop for autonomous coding. This fork is tuned for Codex on Windows and is optimized for resumable PRD-driven work rather than one-off chat turns.

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

Or use an existing plan file:

```bash
ralph prd --plan plan.md
```

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

- `ralph build 1`: default mode for normal multi-story Ralph work.
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
- [Multi-agent outline](docs/multi-agent-outline.md)
- [Tuning TODO](docs/tuning-todo.md)
- [Ralph improvement ideas](docs/ralph-improvement-ideas.md)

## Notes

- Ralph is tuned for Codex and Windows first.
- `ralph prd` expects the `prd` skill to exist for the agent you are using.
- For tiny one-off edits, direct Codex use can still be cheaper than running a full Ralph loop.

## Local Checks

```bash
npm test
npm run bench:quick
```
