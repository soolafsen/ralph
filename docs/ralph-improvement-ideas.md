# Ralph Improvement Ideas

This document consolidates improvement ideas for Ralph gathered from these sources:

- [HKUDS/OpenSpace](https://github.com/HKUDS/OpenSpace)
- [Awesome Ralph](https://github.com/snwfdhmp/awesome-ralph)
- [GSD / get-shit-done](https://github.com/gsd-build/get-shit-done)
- [Aider](https://github.com/Aider-AI/aider)
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)
- [SWE-agent / SWE-bench ecosystem](https://github.com/SWE-agent/SWE-agent)
- [OpenHands benchmarks](https://github.com/OpenHands/benchmarks)

This note is Ralph-specific. It focuses on ideas that fit the current Ralph identity:

- file-based state
- explicit PRD-driven execution
- fresh-context iterations
- strong backpressure and verification
- strong performance focus on wall-clock time, price-ish tokens, and prompt footprint

If an idea is interesting but not a strong fit for Ralph today, it belongs in `docs/other-ideas.md`.

## Core Principle

Ralph should steal mechanisms, not platforms.

The best external ideas are the ones that strengthen Ralph's loop without changing what Ralph is.

For Ralph, an improvement is only worth keeping if it helps at least one of these:

- reduces retries
- reduces wasted verification effort
- reduces prompt footprint
- reduces price-ish tokens
- reduces wall-clock time
- improves repeatability and debuggability from files on disk

If a feature adds another model call, broad context injection, or vague hidden state, it should be treated as guilty until proven useful.

## Highest-Value Ideas

### 1. Reusable Recovery And Verification Recipes

Primary sources:

- OpenSpace
- Ralph ecosystem material from Awesome Ralph

Purpose:

- preserve working operational fixes for recurring repo and environment problems

Examples:

- frontend dev-server startup that actually works in a repo
- browser readiness checks
- fallback test commands
- package-install recovery steps
- Windows-specific process cleanup

Why it fits Ralph:

- it is file-based
- it helps across different stories inside the same PRD
- it mostly captures repo-level operational knowledge, which transfers better than story-specific implementation advice

Expected gains:

- fewer repeated failures
- fewer retries
- less token spend on rediscovering working commands
- faster frontend and environment-heavy runs

Main issues:

- stale recipes can become negative value
- recipes can become too repo-specific without scope metadata

Implementation difficulty:

- low to medium

Performance effect:

- likely the best early ROI
- helps both wall-clock time and token use

Actionable first cut:

- create `.ralph/knowledge/recipes/`
- write small JSON recipe files only when a retry path clearly succeeded
- require one successful reuse before marking a recipe as trusted

Suggested fields:

- `id`
- `kind`
- `trigger`
- `steps`
- `evidence`
- `repoScope`
- `stackHints`
- `successCount`
- `lastValidatedAt`

Good first tests:

- same repo, repeated frontend stories
- stories that need repeated browser verification
- stories that often hit the same setup problem

### 2. Per-Story Reflection Artifacts

Primary sources:

- OpenSpace
- Ralph philosophy from Awesome Ralph

Purpose:

- capture the smallest useful residue from a story run without carrying chat history forward

This should be story-scoped, not whole-run-scoped.

Why story-scoped matters:

- Ralph may execute many stories in one PRD run
- the learning unit needs to be small enough to attribute outcomes
- later stories can benefit from earlier stories in the same run

Expected gains:

- better debugging
- easier later retrieval
- lower repeated exploration cost
- clearer basis for learning and measurement

Main issues:

- reflection can become pure overhead if it requires a second expensive model pass
- verbose reflections become prompt bloat later

Implementation difficulty:

- low

Performance effect:

- positive if generated mostly from existing metadata and heuristics
- negative if it becomes another default LLM call

Actionable first cut:

- add one small JSON artifact beside each existing run summary
- fill it from run status, command outcomes, verification results, and heuristics
- avoid a model-generated reflection in v1

Suggested fields:

- `storyId`
- `iteration`
- `status`
- `whatWorked`
- `whatFailed`
- `successfulRecovery`
- `reuseHints`
- `avoidHints`
- `durationMs`
- `promptBytes`
- `priceishTokens`

Good first tests:

- confirm artifact quality from existing run data only
- confirm no noticeable runtime penalty
- confirm repeated failure patterns become easier to detect

### 3. Backpressure Tuning As A First-Class Design Concern

Primary sources:

- Geoffrey Huntley material surfaced by Awesome Ralph
- Aider's test/lint integration
- GSD's "give the system what it needs to do the work and verify it" workflow framing

Purpose:

- reject bad work early without making the loop so resistant that progress stalls

This is less a single feature and more a design rule for the whole system.

Expected gains:

- fewer false completions
- less hidden rework
- better quality without human babysitting

Main issues:

- too much backpressure increases retries and cost
- too little backpressure lets broken work through and causes larger later failures

Implementation difficulty:

- medium

Performance effect:

- high upside if balanced well
- high downside if gates are noisy or misapplied

Actionable first cut:

- classify checks by cost and confidence
- prefer cheap, high-signal checks first
- only escalate to heavier checks when the story or stack requires them

Useful early categories:

- syntax and type checks
- narrow tests near changed files
- browser smoke checks only when relevant
- full test runs only when the story or gate requires it

Good first tests:

- compare retry count before and after gate tuning
- compare false-done rate
- compare verification cost by story type

### 4. Context Hygiene And Size-Bounded File Memory

Primary sources:

- GSD
- OpenSpace
- Ralph ecosystem material from Awesome Ralph

Purpose:

- keep Ralph's persistent memory useful without allowing it to turn into context rot

GSD is explicit that quality degrades as context fills up, and its core response is to split persistent knowledge into purpose-specific files with size limits and distinct roles.

The Ralph-fit idea is not to copy GSD's full file system or hidden orchestration. The Ralph-fit idea is to keep memory:

- file-based
- purpose-specific
- size-bounded
- easy to inspect
- easy to skip when irrelevant

Expected gains:

- lower prompt footprint growth
- cleaner separation between PRD state, run history, and reusable knowledge
- less tendency for "memory" to become a junk drawer

Main issues:

- too many memory files can create maintenance overhead
- if file roles are not clear, this becomes complexity without benefit

Implementation difficulty:

- low to medium

Performance effect:

- positive if it prevents broad prompt accumulation
- negative if it causes Ralph to read too many files by default

Actionable first cut:

- keep the number of new artifact types small
- assign each file type a narrow purpose and a size cap
- make retrieval selective instead of auto-loading everything
- prefer replacing low-signal memory with compact summaries rather than accumulating raw notes

Suggested first memory buckets:

- story reflections
- recovery recipes
- coarse strategy quality stats

Good first tests:

- compare prompt bytes before and after adding file-based learning
- confirm later iterations do not auto-load all artifact files
- confirm artifact pruning is possible without breaking the loop

### 5. Lightweight Strategy Quality Memory

Primary sources:

- OpenSpace
- Ralph ecosystem ideas around struggle detection and loop steering from Awesome Ralph

Purpose:

- let Ralph learn which of its own strategies are efficient and reliable in practice

Examples:

- tiny mode helped or hurt
- a browser-check path was flaky
- a backend route was stable or unstable
- barebones mode caused rework or was sufficient

Expected gains:

- better defaults
- less repeated use of known-bad paths
- lower runtime and token spend on recurring story patterns

Main issues:

- easy to overfit
- easy to spend more time deciding than doing

Implementation difficulty:

- medium

Performance effect:

- positive if the memory stays coarse and cheap
- negative if strategy selection becomes elaborate

Actionable first cut:

- store a few counters and averages only
- bias choices rather than hard-lock them
- keep scope coarse, such as repo-level or stack-level

Suggested fields:

- `strategy`
- `scope`
- `successCount`
- `failureCount`
- `avgDurationMs`
- `avgPriceishTokens`
- `lastSeenAt`

Good first tests:

- repeated story types in the same repo
- frontend-heavy PRDs
- tiny-task PRDs versus medium PRDs

### 6. Narrow Retrieval Before Prompt Expansion

Primary sources:

- OpenSpace
- Ralph fresh-context philosophy from Awesome Ralph
- Aider's codebase mapping idea, adapted in a much smaller form
- GSD's context engineering and purpose-specific memory files, adapted in a smaller and more explicit form

Purpose:

- inject a few compact relevant artifacts before a story run instead of dragging broad history forward

Expected gains:

- better reuse with lower prompt cost than transcript carry-forward
- fewer exploratory turns on repeated problem types

Main issues:

- bad retrieval is expensive noise
- this is the easiest place to accidentally hurt Ralph's performance profile

Implementation difficulty:

- medium

Performance effect:

- high upside if strict and sparse
- high downside if broad or fuzzy

Actionable first cut:

- retrieve at most a few compact artifacts
- use metadata and lexical matching only
- apply a hard byte cap before any prompt injection
- allow retrieval to return nothing by default when there is no strong match

Suggested match keys:

- story title
- acceptance criteria
- changed file areas
- repo stack hints
- recent failure type

Good first tests:

- repeated verification issues
- repeated setup issues
- similar stories within one PRD

### 7. Scoped Pre-Execution Research

Primary sources:

- GSD's optional `--research` stage
- Aider's practical "look before you leap" workflow bias

Purpose:

- let Ralph do focused up-front investigation only when uncertainty is likely to create expensive retries

This is a better fit than always adding more context or always researching by default.

Expected gains:

- fewer bad first attempts on unfamiliar stacks or libraries
- lower rerun count on stories with implementation uncertainty

Main issues:

- if used too often, research becomes prompt and time overhead
- if allowed to sprawl, it becomes lightweight procrastination

Implementation difficulty:

- medium

Performance effect:

- positive when narrowly targeted at high-uncertainty stories
- negative when used broadly on straightforward tasks

Actionable first cut:

- make it optional and explicit
- trigger only for stories with unfamiliar dependencies, unclear integration points, or repeated failures
- output a tiny artifact that feeds planning or execution instead of a long narrative

Suggested output fields:

- `question`
- `findings`
- `recommendedApproach`
- `pitfalls`
- `evidence`

Good first tests:

- compare retries with and without research on unfamiliar-stack stories
- confirm no research step runs on trivial stories

### 8. Benchmark And Evaluation Discipline

Primary sources:

- SWE-bench ecosystem
- OpenHands benchmarks
- Aider benchmark culture

Purpose:

- make Ralph improvements measurable instead of intuition-driven

Expected gains:

- safer iteration on the loop
- faster rejection of bad ideas
- clearer evidence for performance tradeoffs

Main issues:

- benchmarking itself can become heavy if it is not scoped
- the wrong benchmark can optimize Ralph toward the wrong behavior

Implementation difficulty:

- medium

Performance effect:

- indirect but important
- this is what prevents performance regressions from hiding behind nice-sounding features

Actionable first cut:

- keep a fixed small benchmark suite
- include both tiny and multi-story PRDs
- record wall-clock time, retries, prompt bytes, and price-ish tokens
- compare before and after every loop change

Suggested benchmark categories:

- tiny one-story task
- medium multi-story backend task
- frontend task with browser verification
- repo with flaky setup or test behavior

## Medium-Priority Ideas

### 1. Lightweight Repo Mapping

Primary source:

- Aider

Secondary source:

- GSD's `map-codebase` concept, adapted to avoid parallel-agent or heavy memory assumptions

Purpose:

- give Ralph a compact structural view of the repo without loading broad code context

Why this is only medium priority:

- Ralph already favors fresh iterations and tight prompts
- a repo map can help, but it can also become another static context blob if not constrained

Implementation difficulty:

- medium

Performance effect:

- useful only if the map stays tiny, selective, and mostly derived from static analysis

Good first cut:

- a file/module summary generated from the repo tree and lightweight parsing
- only inject the relevant slice for the current story

### 2. Better Stuck-Loop Detection

Primary sources:

- Ralph ecosystem implementations listed in Awesome Ralph
- Aider's practical workflow bias
- GSD's focus on simple commands and explicit optional stages instead of letting confusion sprawl silently

Purpose:

- detect when the agent is repeating failed behavior, paying token cost, and not making useful progress

Implementation difficulty:

- medium

Performance effect:

- potentially strong wall-clock and token savings

Good first cut:

- count repeated failures of the same class
- count repeated verification failures with no changed files
- detect repeated command attempts with no new evidence
- escalate or stop early when thresholds are crossed

### 3. Versioned Recipe Lineage

Primary source:

- OpenSpace

Purpose:

- keep learned recipes inspectable and reversible as they evolve

Why this is later:

- useful only after recipes and reflections exist

Implementation difficulty:

- medium

Performance effect:

- mostly neutral
- mainly protects debuggability and safe evolution

## Recommended Implementation Order

For the current Ralph shape, the performance-first order is:

1. reusable recovery and verification recipes
2. per-story reflection artifacts
3. backpressure tuning improvements
4. context hygiene and size-bounded file memory
5. lightweight strategy quality memory
6. benchmark and evaluation discipline improvements
7. narrow retrieval before prompt expansion
8. better stuck-loop detection
9. scoped pre-execution research
10. lightweight repo mapping
11. versioned recipe lineage

## Suggested Phased Rollout

### Phase 1: Cheap, File-Based Learning

Build:

- recipe files
- reflection artifacts
- memory size caps and narrow file roles

Do not build yet:

- retrieval
- extra model passes
- embeddings

Phase 1 success criteria:

- no material prompt growth
- no measurable runtime penalty
- fewer repeated retries on the same repo

### Phase 2: Better Local Decisions

Build:

- backpressure tuning
- strategy quality memory
- better stuck-loop detection
- optional scoped research for high-uncertainty stories

Phase 2 success criteria:

- fewer wasted verification passes
- fewer loops that repeat bad behavior
- lower average duration on repeated story classes

### Phase 3: Careful Reuse

Build:

- narrow retrieval
- optional lightweight repo map

Phase 3 success criteria:

- lower prompt footprint than transcript-style carry-forward
- fewer exploratory turns on repeated problem classes
- strict caps keep worst-case cost bounded

## Testing And Benchmarking

Every improvement should be evaluated against Ralph's actual priorities.

Measure at minimum:

- story duration
- total run duration
- retries per story
- prompt bytes
- price-ish tokens
- verification failures
- false-complete rate

Good test matrix:

- tiny one-story PRD
- medium multi-story PRD with related stories
- multi-story PRD with dissimilar stories
- frontend PRD with browser verification
- repo with intentionally flaky setup or tests

Important evaluation question:

- does the feature still help when stories differ a lot

Expected answer:

- operational knowledge should transfer
- implementation-specific guidance usually should not

That should influence what Ralph stores and what it retrieves.

## Guardrails

- learned behavior must stay explicit on disk
- PRD state remains the main control surface
- artifacts must be small and inspectable
- retrieval must be sparse and optional
- no default extra model pass unless it shows measurable savings
- prefer heuristics and static analysis before LLM-generated memory
- prefer no retrieval over bad retrieval
- do not let learned artifacts become hidden mutable state

## Bottom Line

The strongest ideas for Ralph are not "make it more agentic."

They are:

- preserve successful operational knowledge
- preserve compact story-level outcomes
- tune backpressure
- measure everything
- only retrieve small, relevant artifacts when the payoff is likely real

That keeps Ralph aligned with its current identity while still letting it learn.
