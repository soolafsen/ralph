# Ralph Benchmarks

Ralph keeps a fixed benchmark set built around deterministic PRD generator skills.

The benchmark approach stays the same:

- generate a recognizable PRD with a fixed skill
- run Ralph against that PRD in a temp project
- analyze the run
- record the result under `benchmarks/history/` and `benchmarks/latest/`

The benchmark skills still use the stable internal `prdtestNN` names, but benchmark history and suite reporting now use clearer workload-oriented IDs.

## Benchmark Philosophy

The benchmark set is intentionally layered.

That lets Ralph keep forward momentum without turning every feedback loop into a multi-hour run:

- `smoke` for a few-minute sanity check
- `quick` for roughly 30-minute day-to-day feedback
- `hourly` for broader confidence while staying comfortably under an hour on Windows
- `deep` for the broadest coverage before bigger loop changes

## Suites

### Smoke Suite

Use this when you want the cheapest signal possible after a narrow loop change.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`

Why this suite exists:

- exposes raw loop overhead quickly
- keeps setup and verification cheap
- should stay in the low-minutes range on a healthy setup

### Quick Feedback Suite

Use this when you want regular benchmark feedback after runner, prompt, or retry changes.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`
- `quick-node-cli`
- `quick-python-primes`

Why this suite exists:

- keeps a cheap baseline from `smoke`
- adds two recognizable CLI tasks across Node and Python
- aims to stay around 30 minutes instead of drifting toward an hour

### Hourly Coverage Suite

Use this when you want broader coverage without committing to the full deep suite.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`
- `quick-node-cli`
- `quick-python-primes`
- `hourly-python-library`
- `hourly-frontend-build`

Why this suite exists:

- adds cheap library-only and frontend build-only paths
- gives broader stack coverage without pulling in the slowest Windows process-lifecycle benchmark
- aims to stay under 60 minutes, with roughly 45 minutes as the working target

### Deep Coverage Suite

Use this when you want the broadest confidence before larger workflow changes.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`
- `quick-node-cli`
- `quick-python-primes`
- `hourly-python-library`
- `hourly-frontend-build`
- `hourly-node-api`
- `deep-dotnet-crud`
- `deep-react-browser`

Why this suite exists:

- includes all cheaper layers first
- adds deeper .NET workflow coverage
- adds browser-heavier frontend verification pressure
- should stay within roughly 2-3 hours on a healthy setup

## What The Benchmarks Test

- `smoke-node-library`: raw loop overhead with library-only work
- `smoke-node-json-cli`: JSON parsing, file I/O, and focused tests
- `quick-node-cli`: cheap CLI implementation and verification
- `quick-python-primes`: cheap Python CLI and algorithmic correctness
- `hourly-python-library`: Python library work without CLI or server scaffolding
- `hourly-frontend-build`: frontend coding verified by test and build only
- `hourly-node-api`: startup, run instructions, tests, and process lifecycle
- `deep-dotnet-crud`: multi-story .NET workflow with tests and repo structure
- `deep-react-browser`: frontend scaffold, interaction, and browser verification pressure

## Recommended Usage

### For Fastest Feedback

Run the `smoke` suite after:

- narrow prompt changes
- prompt-context changes
- tiny retry or loop-overhead changes

### For Day-To-Day Benchmarking

Run the `quick` suite after:

- loop-controller changes
- token-use optimizations
- retry or stale-recovery changes
- reflection, recipe, or strategy-memory changes

### For Broader Confidence

Run the `hourly` suite before:

- changing verification defaults
- changing process or startup handling
- changing frontend verification expectations
- if you need the API/process-lifecycle benchmark too, use `deep`

### For Largest Changes

Run the `deep` suite before:

- merging larger workflow changes
- changing benchmark-affecting defaults
- altering story-selection logic
- altering progress-context logic

## Metrics That Matter Most

At minimum, compare:

- build time
- build price-ish tokens
- end-to-end price-ish tokens
- iteration count
- prompt bytes
- progress snapshot bytes
- per-story duration and token breakdown

## Future Extensions

Useful later additions:

- seeded repo edit benchmarks
- suite regression thresholds
- aggregate regressions by category
- quality counters such as retries or reopened stories
