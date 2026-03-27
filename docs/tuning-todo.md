# Tuning TODO

This document is the short list of follow-up work that is useful to revisit after the current merge wave.

It is intentionally practical and benchmark-driven. Items here are not blockers unless explicitly promoted elsewhere.

## Near Term

- Re-run `bench:quick` a few more times to establish a less noisy post-refactor baseline.
- Run `bench:hourly` enough times to get a real comparison history for the new middle layer.
- Confirm that reflection artifacts stay small and readable as benchmark history grows.
- Review recipe promotion thresholds and demotion behavior after more real runs.
- Review strategy memory growth and make sure stale or low-signal stats do not accumulate forever.

## Needs Benchmark Evidence

- Revisit backpressure tuning once `smoke`, `quick`, and `hourly` have enough history to compare like-for-like.
- Measure whether recipe and strategy prompt injection are earning their token cost.
- Decide whether backpressure should stay as soft prompt guidance or grow into harder budgeting rules.
- Check whether tiny-mode guidance is helping enough to justify its prompt footprint.
- Check whether browser-verification hints are helping frontend runs or just adding context weight.
- Measure whether reflection-driven recovery reduces iteration count often enough to justify the added bookkeeping.

## Possible Runner Improvements

- Add a cap or summarization step if recipe or strategy context starts growing too large.
- Consider aging, decay, or sample windows for strategy stats instead of lifetime counters only.
- Consider confidence scoring for recipes so single flaky successes do not look more trustworthy than they are.
- Consider distinguishing cheap verification from expensive verification in strategy memory.
- Consider separate strategy tracking for greenfield repos versus edit-existing-code repos.
- Consider storing a compact explanation for why a story was marked stuck, not just that it was.

## Benchmark Suite Follow-ups

- Decide whether any current `quick` workloads belong in `smoke` or `hourly` after more timing data.
- Add a small edit-existing-code benchmark, since real use is often patching rather than greenfield building.
- Add a tiny API patch benchmark against an existing seeded project to isolate change-cost from scaffold-cost.
- Consider one cheap TypeScript library benchmark if Node CLI coverage proves too narrow.
- Keep suite names stable unless there is a strong reason to change them again; history continuity matters.
- Avoid adding benchmarks to `quick` unless they protect a real blind spot and still preserve sub-30-minute feedback.

## Known Issues

- Windows benchmark workspaces can hit `EPERM` locking on some paths during repeated deep runs.
- Deep-suite history is still too sparse to support strong before/after performance claims.
- Backpressure tuning is merged as a first-pass bias layer, not a finished optimization system.
- Benchmark comparison output is only meaningful once each suite has enough clean history after the suite reset.

## Merge-After Notes

- Treat the first three tuning features as operationally solid: reflection artifacts, recipe memory, and stuck-loop detection.
- Treat strategy memory and backpressure tuning as active tuning areas rather than completed optimization work.
- Prefer evidence-driven changes now that the benchmark layers are cleaner.
