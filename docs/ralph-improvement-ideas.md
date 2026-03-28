# Ralph Improvement Ideas

This note is intentionally pruned to ideas that still look meaningfully missing in Ralph today.

It excludes areas Ralph already has in some form, including:

- a single-agent fresh-context loop
- repo-level instructions via `AGENTS.md`
- reusable skills
- benchmark suites
- run logs and file-based state
- multiple operating modes such as normal, tiny, and barebones

The goal here is not to make Ralph more "agentic". It is to make the single-agent loop more disciplined, more repeatable, and easier to improve over time.

## 1. Add A First-Class Hook System

Why useful:

- repeated checks should live in code, not only in prompts or scattered scripts

Practical implication:

- define stable lifecycle events such as `before-run`, `after-run`, `before-verify`, `after-failure`, and `before-commit`

How it would improve Ralph:

- gives the single-agent loop a clean extension point for guardrails, checks, and automation without changing the core loop model

Expected outcome:

- more consistent runs
- fewer repeated mistakes
- easier addition of repo-specific guardrails

Implementation complexity:

- medium

## 2. Separate Stable Policy From Transient Run Memory More Explicitly

Why useful:

- instructions, durable rules, strategy notes, current progress, and raw logs have different lifetimes and should not blur together

Practical implication:

- define clearer buckets for repo policy, current run state, learned heuristics, and archived history

How it would improve Ralph:

- reduces prompt drift and stale-memory effects across longer runs

Expected outcome:

- cleaner iteration context
- less accidental reuse of outdated guidance
- easier harness tuning

Implementation complexity:

- low to medium

## 3. Add Architecture Decision Records Under `docs/decisions/`

Why useful:

- important design choices should be durable and reviewable instead of being implied by prompts, scripts, or old commits

Practical implication:

- add short ADRs for memory design, benchmark philosophy, retry behavior, verification strategy, and Windows-specific tradeoffs

How it would improve Ralph:

- makes future changes easier to reason about for both humans and agents

Expected outcome:

- better maintainability
- less architectural drift
- easier onboarding into Ralph internals

Implementation complexity:

- low

## 4. Add Subsystem-Scoped Instruction Files

Why useful:

- root-level instructions are too broad for specialized areas like benchmarks, browser tooling, runner internals, and skills

Practical implication:

- allow local instruction files near sensitive or specialized subsystems

How it would improve Ralph:

- narrows the working context for the single agent and gives more precise guidance where it matters

Expected outcome:

- fewer irrelevant edits
- better local decisions
- less overloading of the root instruction file

Implementation complexity:

- low to medium

## 5. Add Failure-To-Guardrail Promotion

Why useful:

- if the same class of failure happens repeatedly, Ralph should harden itself instead of rediscovering the same lesson

Practical implication:

- detect recurring failure signatures and draft or apply a new guardrail, check, or recovery pattern

How it would improve Ralph:

- turns repeated errors into durable harness improvements

Expected outcome:

- fewer recurring regressions
- faster convergence during tuning
- better use of run history

Implementation complexity:

- medium to high

## 6. Expand Operational Skills For Common Single-Agent Work

Why useful:

- common tasks should have repeatable playbooks instead of relying on generic prompting every time

Practical implication:

- add focused skills such as `code-review`, `refactor`, `release-notes`, `benchmark-triage`, and `regression-investigation`

How it would improve Ralph:

- makes the single agent more capable without adding orchestration complexity

Expected outcome:

- higher-quality outputs
- lower variance between runs
- better reuse of good operating patterns

Implementation complexity:

- low to medium

## 7. Add Automatic Post-Run Synthesis

Why useful:

- raw logs are noisy; what matters is what was learned and what should happen next

Practical implication:

- after each run, write a short structured summary of outcome, failures, successful recoveries, and suggested follow-up

How it would improve Ralph:

- converts run output into usable memory instead of leaving most value trapped in logs

Expected outcome:

- better next-iteration context
- easier debugging
- easier human review of Ralph runs

Implementation complexity:

- medium

## 8. Link Benchmark Regressions To Guardrails And Tuning Decisions

Why useful:

- benchmarks are already present, but they should feed back into harness behavior more directly

Practical implication:

- when a loop, prompt, or memory change regresses time, tokens, or completion rate, flag it and tie it to the relevant subsystem or change class

How it would improve Ralph:

- makes harness tuning more evidence-driven and less intuition-driven

Expected outcome:

- fewer silent performance regressions
- safer iteration on loop behavior
- faster rejection of bad ideas

Implementation complexity:

- medium

## Suggested Priority Order

1. first-class hook system
2. stable policy vs transient memory split
3. failure-to-guardrail promotion
4. architecture decision records
5. post-run synthesis
6. benchmark-linked guardrails
7. subsystem-scoped instruction files
8. expanded operational skills

## Bottom Line

The best next improvements for Ralph are not about adding more agents.

They are about strengthening the single-agent loop with:

- clearer structure
- stronger guardrails
- better durable project knowledge
- better learning from repeated failures
- tighter feedback from benchmarks back into harness design
