---
name: prdtest03
description: "Deterministic benchmark PRD for a C# program that reads and writes data to an in-memory database-like store. Use when the user asks for prdtest03, a simple C# benchmark PRD, or a .NET in-memory CRUD benchmark for Ralph testing."
owner: ralph
scope: project
---

# PRDTEST03 C# In-Memory DB

Generate a deterministic compact JSON PRD for a small C# benchmark app.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and recognizable.

## Required Top-Level Values

- `project`: `PRDTEST03 CSharp InMemory DB`
- `overview`: Small .NET console app that performs simple create, read, update, and list operations against an in-memory repository, with tests and usage instructions.
- `qualityGates`:
  - `dotnet build`
  - `dotnet test`

## Required Assumptions

- Use a .NET console app
- Use an in-memory repository, not a real database package
- Keep the program local-only and deterministic

## Required Story Plan

Create exactly 4 stories.

### US-001

- Title: `Scaffold the .NET console app and domain model`
- Scope:
  - create the console project
  - define a small record or entity model
  - keep the shape ready for in-memory storage
- Acceptance must include:
  - success example for the project building cleanly
  - negative case for the app not requiring any external database or connection string

### US-002

- Title: `Implement the in-memory repository`
- Scope:
  - support create and read operations
  - keep state in memory only
  - separate repository logic from presentation
- Acceptance must include:
  - success example for reading back inserted data
  - negative case for missing ids or keys returning a safe not-found result

### US-003

- Title: `Add update flow and console demonstration`
- Scope:
  - add update and list behavior
  - wire the console app to demonstrate the repository operations
  - keep the demo output readable
- Acceptance must include:
  - success example for create-read-update-list flow
  - negative case for an invalid update not corrupting existing in-memory data

### US-004

- Title: `Add tests and README usage instructions`
- Scope:
  - add unit tests for repository behavior
  - expose build and test workflow
  - add or refresh README with install and run steps
- Acceptance must include:
  - success example for `dotnet test`
  - negative case for tests not relying on timing, randomness, or external services

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Do not convert the benchmark into a real database app
