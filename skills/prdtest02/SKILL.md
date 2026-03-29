---
name: prdtest02
description: "Deterministic benchmark PRD for a Python program that calculates the first 99 prime numbers. Use when the user asks for prdtest02, a simple Python benchmark PRD, or a small non-UI PRD for Ralph testing."
owner: ralph
scope: project
---

# PRDTEST02 Python 99 Primes

Generate a deterministic compact JSON PRD for a small Python benchmark program.

Use this skill together with `$prd`. Do not ask follow-up questions. Keep the scope fixed and recognizable.

## Required Top-Level Values

- `project`: `PRDTEST02 Python 99 Primes`
- `overview`: Small Python command-line program that calculates and prints the first 99 prime numbers with minimal tests and usage instructions.
- `qualityGates`:
  - `python main.py`
  - `pytest`

## Required Assumptions

- Use Python 3 standard library
- Keep it as a local command-line program
- Do not add databases, web servers, or packaging complexity

## Required Story Plan

Create exactly 3 stories.

### US-001

- Title: `Scaffold the Python CLI and output shape`
- Scope:
  - create a runnable Python entrypoint
  - define the expected output format for 99 primes
  - separate the main execution path from core logic
- Acceptance must include:
  - success example for running the script from the command line
  - negative case for startup not failing when no optional arguments are provided

### US-002

- Title: `Implement prime generation for the first 99 results`
- Scope:
  - implement correct prime detection and collection
  - return exactly 99 primes in order
  - keep the implementation simple and readable
- Acceptance must include:
  - success example for the first few known primes being correct
  - negative case for not including non-primes such as 1 or composite numbers

### US-003

- Title: `Add tests and README usage instructions`
- Scope:
  - add pytest coverage for prime generation behavior
  - verify the command-line run still works
  - add or refresh README with install and run steps
- Acceptance must include:
  - success example for pytest passing
  - negative case for the script and tests not depending on hidden state or external services

## Output Rules

- Keep the PRD compact
- Keep all story statuses as `open`
- Do not add extra stories
- Do not expand scope beyond the prime-number program
