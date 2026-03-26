# Multi-Agent Outline

This note captures a practical path for evolving Ralph from today's single-agent loop into controlled multi-agent orchestration.

The key point is that Ralph already has the right basic ingredients:

- explicit PRD state
- story selection
- run logs
- prompt rendering
- a loop controller

That is enough to grow into multi-agent execution without replacing the current design.

## Design Goal

Keep Ralph understandable and file-driven while expanding it beyond one agent per iteration.

The target is not "let many bots loose." The target is disciplined orchestration with clear ownership, bounded handoffs, and observable state.

## Good First Step

Start with a single coordinator and optional helper agents.

Coordinator responsibilities:

- own PRD state
- select the next actionable story
- decide whether helper agents are needed
- collect outputs
- decide whether the story is complete, blocked, or needs another pass

Helper agent responsibilities:

- work on a narrow, explicit subtask
- return structured output through files or run artifacts
- avoid hidden state or vague conversational handoff

This keeps one source of truth while still allowing specialization.

## Recommended Initial Roles

The first helper roles should be low-risk sidecars:

- `implementer`
- `reviewer`
- `browser-checker`
- `docs-writer`

These roles map cleanly onto work Ralph already performs informally during a story.

## What To Parallelize First

Parallelize analysis and verification before parallelizing code edits.

Good early candidates:

- browser smoke checks
- test verification
- code review
- README or run-instruction drafting

These tasks are easier to isolate and less likely to create conflicting edits.

## What Not To Do First

Avoid these in the first multi-agent version:

- multiple agents editing overlapping files at the same time
- dynamic autonomous delegation everywhere
- hidden inter-agent memory
- a "swarm" model with weak ownership

That kind of system becomes hard to debug quickly and works against Ralph's current strength, which is explicit file-based state.

## Handoff Model

Agent communication should happen through explicit artifacts, not implied chat context.

Examples:

- task files
- run summaries
- review notes
- verification reports
- changed-file manifests

The coordinator should be able to inspect these artifacts and make the next decision deterministically.

## Suggested Execution Model

Stage 1:

- coordinator selects a story
- coordinator may spawn one helper for a bounded task
- helper writes an artifact
- coordinator finishes the story

Stage 2:

- coordinator may use several sidecar helpers for review, browser checks, or docs
- only one agent edits the code by default

Stage 3:

- allow multiple code-editing helpers only when write ownership is explicit and disjoint
- require a merge or integration pass before story completion

## Repo-Level Changes Likely Needed

Ralph would eventually need:

- role-specific prompts
- structured helper output files
- per-run task manifests
- helper lifecycle logging
- explicit ownership metadata for write scopes
- coordinator rules for when parallelism is allowed

These should be added incrementally rather than bundled into one large rewrite.

## Success Criteria

A multi-agent Ralph should still be:

- understandable from files on disk
- resumable after interruption
- debuggable from run logs
- safe around repo state
- conservative about parallel edits

If a multi-agent expansion makes those worse, it is the wrong design.

## Short Version

Yes, Ralph can grow into multi-agent orchestration.

The sensible path is:

- one coordinator
- a few bounded helper roles
- artifact-based handoff
- verification sidecars first
- parallel code editing only after ownership rules are explicit

That keeps the current Ralph model intact while expanding what it can coordinate.
