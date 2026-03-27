# Benchmarking

Ralph benchmarks are built around deterministic PRD generator skills.

Each benchmark run:

- generates a recognizable PRD with a fixed skill
- runs Ralph against that PRD in a temp project
- analyzes the run
- records the result under `benchmarks/history/` and `benchmarks/latest/`

The benchmark skills keep the stable internal `prdtestNN` names, but benchmark history and suite reporting use clearer workload-oriented IDs.

## Benchmark IDs

- `smoke-node-library`: smallest library-only overhead benchmark
- `smoke-node-json-cli`: smallest JSON/file benchmark
- `quick-node-cli`: cheap Node CLI benchmark for token and overhead checks
- `quick-python-primes`: cheap Python CLI benchmark
- `hourly-python-library`: cheap Python library benchmark
- `hourly-frontend-build`: frontend benchmark verified by build and tests only
- `hourly-node-api`: lightweight Node API benchmark for startup and process lifecycle
- `deep-dotnet-crud`: deeper .NET in-memory CRUD benchmark
- `deep-react-browser`: browser-verified frontend benchmark

## Suites

### `smoke`

Use for the cheapest sanity check after narrow loop changes.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`

Target:

- roughly low-minutes feedback

### `quick`

Use for normal day-to-day benchmark feedback after prompt, loop, retry, or memory changes.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`
- `quick-node-cli`
- `quick-python-primes`

Target:

- roughly 30 minutes

### `hourly`

Use for broader stack coverage without committing to the full deep suite.

Benchmarks:

- `smoke-node-library`
- `smoke-node-json-cli`
- `quick-node-cli`
- `quick-python-primes`
- `hourly-python-library`
- `hourly-frontend-build`
- `hourly-node-api`

Target:

- roughly an hour to 90 minutes

### `deep`

Use for the broadest confidence before larger workflow changes.

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

Target:

- roughly 2 to 3 hours

## Commands

Run a suite:

```bash
ralph bench:smoke
ralph bench:quick
ralph bench:hourly
ralph bench:deep
```

If Windows leaves a benchmark workspace locked after a failed or interrupted suite, you can rerun a suite against a fresh workspace root:

```bash
set RALPH_BENCHMARK_WORKSPACE_ROOT=C:\temp\ralph-bench-workspaces
npm run bench:hourly
```

Analyze a real project run:

```bash
npm run benchmark:run -- C:\path\to\project
```

Record a benchmark run:

```bash
npm run benchmark:record -- --benchmark quick-node-cli C:\path\to\project
```

Compare history for one benchmark:

```bash
npm run benchmark:compare -- --benchmark quick-node-cli
```

Compare the latest results for a suite:

```bash
npm run benchmark:suite -- --suite quick
```

## Metrics That Matter Most

At minimum, compare:

- build time
- build price-ish tokens
- end-to-end price-ish tokens
- iteration count
- prompt bytes
- progress snapshot bytes
- per-story duration and token breakdown

Benchmark history uses **price-ish tokens** as the primary metric:

- `price-ish = uncached input + output + reasoning`
- cached input is stored separately as prompt reuse detail
- raw input is stored separately as prompt footprint detail
