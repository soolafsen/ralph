# Ralph Benchmarks

Ralph keeps a fixed benchmark set built around deterministic PRD generator skills.

The benchmark approach stays the same:

- generate a recognizable PRD with a fixed skill
- run Ralph against that PRD in a temp project
- analyze the run
- record the result under `benchmarks/history/` and `benchmarks/latest/`

What changes here is the benchmark structure.

## Benchmark Philosophy

The current benchmark PRDs are still useful and should be kept.

They are intentionally small enough to run regularly, but varied enough to expose different Ralph behaviors:

- tiny loop overhead
- cheap CLI work
- process lifecycle and run instructions
- multi-story CRUD structure
- frontend verification pressure

There is no existing benchmark history in this repo yet, so the benchmark metadata can be reset cleanly without losing meaningful comparisons.

## Suites

### Quick Feedback Suite

Use this when you want fast signal after loop or prompt changes.

Benchmarks:

- `prdtest04` Node Tiny CLI
- `prdtest02` Python 99 Primes

Why this suite exists:

- fast enough to run often
- covers tiny-task overhead and cheap non-UI execution
- good first pass for token and runtime regressions
- should have the best chance of staying under roughly 20 minutes total

### Deep Coverage Suite

Use this when you want broader confidence before merging meaningful Ralph changes.

Benchmarks:

- `prdtest04` Node Tiny CLI
- `prdtest02` Python 99 Primes
- `prdtest05` Node Tiny API
- `prdtest03` C# In-Memory DB
- `prdtest01` React Styled Hello

Why this suite exists:

- includes the quick suite
- adds server/process lifecycle coverage
- adds a deeper multi-story .NET task
- adds a frontend task with more verification pressure
- should stay within roughly 2-3 hours on a healthy setup

## What The Existing PRDs Test

- `prdtest04`: raw loop overhead and cheap verification
- `prdtest02`: simple algorithmic CLI work with very low setup cost
- `prdtest05`: process lifecycle, startup, tests, and run instructions
- `prdtest03`: multi-story .NET workflow with repository structure and tests
- `prdtest01`: frontend scaffold, interaction, and verification pressure

## Are The Existing PRDs Good Enough?

Yes, with caveats.

They are good enough to keep as Ralph's core benchmark set because they are:

- deterministic
- recognizable
- small enough to rerun often
- varied across stacks and task shapes

They are not enough to answer every question. The biggest gap is not the benchmark idea itself. The biggest gap is suite-level usage and comparison.

That is why this repo now defines:

- benchmark tiers
- suite metadata
- aggregate suite reporting

## Recommended Usage

### For Quick Feedback

Run the `quick` suite after:

- prompt changes
- loop-controller changes
- token-use optimizations
- retry or stale-recovery changes

If a change specifically targets startup, process handling, or run-instruction behavior, also run `prdtest05` even if it is not part of the default quick suite.

### For Deeper Confidence

Run the `deep` suite before:

- merging larger workflow changes
- changing benchmark-affecting defaults
- altering verification behavior
- changing story-selection or progress-context logic

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

- suite regression thresholds
- aggregate regressions by category
- quality counters such as retries or reopened stories
- repo-grounded benchmark projects outside the fixed PRD skill set
