# Ideas To Steal From OpenSpace

This note captures the parts of [HKUDS/OpenSpace](https://github.com/HKUDS/OpenSpace) that look useful for Ralph, without assuming Ralph should adopt OpenSpace as a framework.

The goal is to preserve Ralph's current strengths:

- file-based state
- explicit PRD-driven execution
- low prompt overhead
- resumable runs
- debuggable artifacts on disk

OpenSpace is most useful here as a source of learning-loop mechanics, not as a platform to copy.

## Performance Principle

Ralph has a strong performance focus:

- lower wall-clock time
- lower price-ish tokens
- lower prompt footprint

Any OpenSpace-inspired feature should be judged by that standard.

For Ralph, a learning feature is only worth keeping if it does at least one of these:

- reduces repeated trial-and-error
- avoids known flaky execution paths
- shrinks future prompt/context cost
- lowers rerun count for similar stories

If a feature adds extra model calls, larger prompts, or fuzzy retrieval without measurable savings, it is not a good fit.

## Short Version

The main idea worth stealing is:

1. run one story
2. reflect on the run in a structured way
3. save only the reusable parts
4. retrieve those parts selectively on later stories

That fits Ralph far better than a broad "self-evolving agent" model.

## Best Fits For Ralph

### 1. Per-Iteration Reflection Artifacts

Applicability:

- Single-agent: strong fit
- Multi-agent: strong fit

Ralph already writes run summaries, logs, and metrics under `.ralph/`.

The next logical step is to add a compact reflection artifact after each iteration, for example:

- what worked
- what failed
- what recovery path succeeded
- what should be reused next time
- what should be avoided next time

This should be small, deterministic, and file-based.

Suggested shape:

- one JSON or Markdown artifact beside each run summary
- tied to a specific story and iteration
- generated whether the story succeeds or fails

Why this is high value:

- it builds reusable memory without dragging full history into future prompts
- it fits Ralph's existing `.ralph/runs/` model cleanly
- it creates better debugging artifacts than raw logs alone

Performance impact:

- likely positive if reflections stay tiny and structured
- negative if this adds a full extra LLM pass or verbose summaries every run

Main gain:

- future similar stories can reuse a compact outcome instead of re-reasoning from scratch

Main risk:

- reflections can become prompt bloat if they are long, low-signal, or always injected later

Implementation difficulty:

- low

Actionable first cut:

- write one small JSON file per iteration next to the existing run artifacts
- populate it mostly from existing run metadata, status, and heuristics
- only add a model-generated reflection later if the heuristic version proves insufficient

Suggested fields:

- `storyId`
- `iteration`
- `status`
- `whatWorked`
- `whatFailed`
- `successfulRecovery`
- `reuseHints`
- `avoidHints`
- `promptCostBytes`
- `priceishTokens`
- `durationMs`

Success criteria:

- no extra model call in v1
- artifact size remains small and capped
- later runs show reduced repeated failure patterns or lower retry counts

### 2. Reusable Recovery Recipes

Applicability:

- Single-agent: strong fit
- Multi-agent: strong fit

One of OpenSpace's strongest ideas is treating failure recovery patterns as reusable assets.

For Ralph, the most useful recipes are likely not domain knowledge. They are execution patterns such as:

- browser verification setup that actually works in a given repo
- fallback test commands
- package manager or install recovery steps
- frontend dev-server startup and readiness checks
- Windows-specific shell or process handling workarounds

This is a better fit than trying to evolve full task skills.

Suggested shape:

- a local library of small recipe files under `.ralph/knowledge/` or a similar folder
- each recipe includes trigger conditions, recovery steps, and evidence that it worked
- recipes are promoted only after successful reuse

Why this is high value:

- Ralph already spends effort on reliability and verification
- repeated tool and environment failures are a real source of cost
- recipes are easier to debug than mutable prompts

Performance impact:

- strongly positive if recipes eliminate repeated setup failures, flaky verification, or avoidable retries
- mildly negative if Ralph keeps attempting stale recipes that no longer apply

Main gain:

- lower wall-clock time and token spend from skipping repeated troubleshooting

Main risk:

- stale or over-specific recipes can waste time if they are applied too eagerly

Implementation difficulty:

- low to medium

Actionable first cut:

- create a local recipe folder for recovery and verification patterns
- only save a recipe when it clearly resolved a failure or shortened a retry path
- attach simple evidence such as the successful command, affected files, and the run id
- require at least one successful reuse before promoting a recipe to default use

Suggested fields:

- `id`
- `kind`
- `trigger`
- `steps`
- `evidence`
- `successCount`
- `lastValidatedAt`
- `repoScope`
- `stackHints`

Good initial recipe categories:

- frontend dev-server startup
- browser verification readiness checks
- fallback test commands
- package install recovery
- Windows-specific process cleanup

Success criteria:

- fewer repeated setup and verification failures
- lower average retries per story
- measurable wall-clock savings on frontend and environment-heavy stories

### 3. Retrieval Before Prompt Expansion

Applicability:

- Single-agent: strong fit
- Multi-agent: strong fit

Ralph is already optimized to avoid carrying large context across iterations.

That makes selective retrieval more attractive. Before a story run, Ralph could retrieve only a few relevant artifacts, such as:

- prior reflections for similar stories
- proven recovery recipes
- verification patterns for similar stacks
- previous notes for the same PRD or file area

This should stay narrow. Ralph should retrieve a few compact artifacts, not rebuild a chat transcript.

Why this is high value:

- it supports Ralph's low-context design instead of fighting it
- it should reduce repeated trial-and-error
- it can improve reliability without a large prompt tax

Performance impact:

- high upside if retrieval is narrow and accurate
- high downside if retrieval adds irrelevant context or a heavy search pipeline

Main gain:

- better decisions with smaller prompts than transcript carry-forward

Main risk:

- low-quality retrieval will increase both token usage and latency

Implementation difficulty:

- medium

Actionable first cut:

- retrieve at most a few compact artifacts
- rank only with simple metadata and lexical matching in v1
- apply strict byte caps before anything is injected into a prompt
- prefer retrieval for known expensive categories such as browser verification, test recovery, and repeated stack patterns

Suggested retrieval inputs:

- story title
- acceptance criteria
- changed file areas
- repo stack hints
- recent failure type

Suggested v1 limits:

- max 3 artifacts
- max total injected bytes cap
- no embeddings
- no model-ranked retrieval

Success criteria:

- prompt size does not materially regress
- similar stories show fewer exploratory turns
- repeated repo-specific failures drop after relevant artifacts exist

## Medium-Fit Ideas

### 4. Lightweight Strategy Quality Memory

Applicability:

- Single-agent: strong fit
- Multi-agent: strong fit

OpenSpace tracks tool quality and uses that signal later.

Ralph could do a smaller version for its own execution strategies, for example:

- which verification path succeeded
- whether tiny mode helped or hurt for a certain class of story
- whether a given backend path was stable
- whether browser checks were flaky in a specific repo

This does not need to be complex. A few counters and timestamps may be enough.

Why this is useful:

- Ralph already measures token cost, prompt size, and timing
- adding outcome-based strategy memory would improve decisions without changing the basic loop

Performance impact:

- positive if it helps Ralph avoid slow or flaky default paths
- minimal overhead if it is stored as simple counters and timestamps

Main gain:

- better default decisions about verification and execution modes

Main risk:

- overfitting or overcomplicating the decision logic can cost more than it saves

Implementation difficulty:

- medium

Actionable first cut:

- track a few coarse counters for major strategies
- update them from existing run outcomes rather than from extra agent work
- use them only to bias decisions, not to hard-lock behavior

Good initial strategy dimensions:

- tiny mode helped or hurt
- browser verification path passed or flaked
- backend path was stable or unstable
- barebones mode was sufficient or caused rework

Suggested fields:

- `strategy`
- `scope`
- `successCount`
- `failureCount`
- `lastSeenAt`
- `avgDurationMs`
- `avgPriceishTokens`

Success criteria:

- fewer poor default strategy choices
- lower average duration or token use for repeated story types
- no noticeable planning overhead from the scoring itself

### 5. Versioned Recipe Lineage

Applicability:

- Single-agent: useful later
- Multi-agent: useful later

OpenSpace stores skill lineage and evolution history.

Ralph could borrow the smaller idea: track revisions of reusable recipes or prompt fragments instead of silently replacing them.

This matters if Ralph starts learning from runs. The key question becomes:

- which version helped
- which version regressed
- which version should stay the default

Why this is only medium priority:

- it is useful only after reusable artifacts exist
- too much versioning too early can create noise

### 6. Explicit Sidecar Roles With Artifact Handoffs

Applicability:

- Single-agent: low value
- Multi-agent: strong fit

This overlaps with Ralph's existing multi-agent outline.

OpenSpace's host skills are useful mainly as a reminder that tools alone are not enough. The coordinator also needs explicit policy for when to:

- reuse
- retry
- verify
- delegate
- escalate

Ralph should keep this explicit and artifact-driven, consistent with the plan in `docs/multi-agent-outline.md`.

## Bad Fits For Ralph

These ideas should be avoided or delayed heavily.

### 1. Full Self-Evolving Runtime Behavior

Applicability:

- Single-agent: avoid
- Multi-agent: avoid

Ralph is valuable because it is understandable from the files on disk.

If Ralph starts mutating its behavior too freely between runs, it will become harder to:

- debug
- reproduce
- trust
- benchmark

Any learned behavior should be explicit, inspectable, and easy to disable.

### 2. Cloud Skill Sharing

Applicability:

- Single-agent: avoid for now
- Multi-agent: avoid for now

This introduces:

- provenance problems
- trust problems
- compatibility problems
- unclear quality guarantees

Ralph should stay local-first unless there is a very strong reason to expand beyond that.

### 3. Heavy Retrieval and Ranking Stacks Too Early

Applicability:

- Single-agent: avoid early
- Multi-agent: avoid early

OpenSpace describes richer ranking and search approaches.

Ralph should start much smaller:

- metadata
- lexical search
- simple success scores

Embeddings or model-ranked retrieval should only come later if the basic artifact model proves valuable.

## Recommended Order

If Ralph adopts any of this, the likely order should be:

1. Add a local library of reusable recovery and verification recipes.
2. Add per-iteration reflection artifacts beside existing run outputs.
3. Track simple reliability scores for strategies and helpers.
4. Retrieve a small number of relevant artifacts before story execution.
5. Add versioned lineage for recipes only after the above proves useful.

This order is performance-first.

The earliest wins are likely to come from eliminating repeated operational failures before adding any retrieval layer.

## Single-Agent Versus Multi-Agent Read

If Ralph remains single-agent, the most relevant ideas are:

- per-iteration reflection artifacts
- reusable recovery recipes
- lightweight strategy quality memory
- retrieval before prompt expansion

These improve one-agent reliability and reduce repeated trial-and-error without changing Ralph's core loop.

For a performance-first single-agent Ralph, the preferred implementation order is:

1. reusable recovery recipes
2. per-iteration reflection artifacts
3. lightweight strategy quality memory
4. retrieval before prompt expansion

This order reflects expected ROI in:

- wall-clock time
- price-ish tokens
- prompt footprint stability

If Ralph later grows multi-agent behavior, the same ideas still help, but one additional area becomes much more important:

- explicit sidecar roles with artifact handoffs

That idea is mostly unnecessary in a pure single-agent loop and should not drive the design unless multi-agent orchestration becomes real.

## Guardrails

Any Ralph implementation inspired by OpenSpace should follow these rules:

- learned behavior must be stored as explicit files
- retrieval must stay compact and selective
- failed experiments must be easy to inspect and roll back
- only promote reusable artifacts after observable success
- do not let learning hide the story-level state machine
- do not let "agent memory" replace PRD state, logs, or run summaries
- do not add default extra model passes unless they show measurable savings
- cap artifact size and retrieved context aggressively
- prefer heuristics and existing run metadata before adding new LLM work

## Implementation Notes

If work starts later, these are the practical boundaries to keep it safe.

Scope boundaries:

- do not change Ralph into a chat-memory system
- do not replace PRD state with learned artifacts
- do not build broad search infrastructure first
- do not add cloud sync or shared skill distribution

Preferred storage:

- keep artifacts under `.ralph/`
- use simple JSON files first
- keep filenames and schemas deterministic

Preferred rollout:

1. write artifacts only
2. inspect artifact quality manually
3. use artifacts for reporting only
4. use artifacts to bias behavior in narrow cases
5. only later inject artifacts into prompts

Benchmarking expectations:

Every phase should be measured against Ralph's existing performance priorities:

- story duration
- retries per story
- prompt bytes
- price-ish tokens
- frontend verification success rate
- rerun rate after partial failure

Kill criteria:

- prompt size grows without a matching drop in retries
- artifact generation adds noticeable runtime overhead
- retrieval often injects irrelevant context
- learned artifacts become hard to inspect or prune

## Bottom Line

OpenSpace is worth studying because it treats successful and failed executions as raw material for future improvement.

For Ralph, the useful part is not "self-evolving skills."

The useful part is a disciplined loop of:

- run
- reflect
- extract reusable knowledge
- retrieve it later with tight scope

If Ralph keeps that explicit and file-based, it can gain some of OpenSpace's upside without losing its current simplicity.
