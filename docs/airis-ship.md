# `airis ship` Reference

`airis ship` orchestrates the complete development lifecycle for a task, from initial request through verified completion with proof.

## Overview

Instead of manually running individual commands, `airis ship` manages the entire workflow:

1. Accepts a task description
2. Generates a mission contract with acceptance criteria
3. You review and approve the contract
4. Creates a tracked TODO list
5. Implements changes (you or the AI)
6. Runs formatting and type checks
7. Executes tests and build
8. Verifies acceptance criteria with evidence
9. Produces a proof report
10. Optionally commits or creates a PR

## Commands

### Start a Workflow

```bash
airis ship start "Build a professional notes application"
```

Creates a new ship workflow and transitions through the initial phases (request, contract, approval, planning).

### Check Status

```bash
# Active workflow
airis ship status

# Specific workflow
airis ship status ship_abc123_def456
```

### Resume an Interrupted Workflow

```bash
airis ship resume
```

Picks up where you left off. The state persists in `.airis/ship/` so interrupted work can always be resumed.

### Cancel a Workflow

```bash
airis ship cancel
```

Marks the workflow as cancelled. Cannot be undone.

### List All Workflows

```bash
airis ship list
```

Shows all ship workflows with their current phase and request.

## Phases

The ship workflow progresses through these phases:

| Phase | Description | Automatic? |
|-------|-------------|-----------|
| `request` | Accepts task description | Yes |
| `contract` | Generates mission contract with acceptance criteria | Yes |
| `approval` | Displays contract for review | Yes |
| `planning` | Creates TODO list for tracking | Yes |
| `implementation` | Code changes are made | Manual |
| `formatting` | Runs `npm run check` (lint, format, type check) | Automatic |
| `testing` | Runs `npm run build` | Automatic |
| `verification` | Verifies acceptance criteria with evidence | Automatic |
| `proof` | Generates proof report | Automatic |
| `completed` | All mandatory criteria pass | Terminal |

### Manual Phases

The **implementation** phase requires manual work. After making your changes, run `airis ship resume` to proceed to formatting and testing.

### Automatic Phases

The formatting, testing, verification, and proof phases run automatically when you resume from implementation.

## State Persistence

Ship state is stored in `.airis/ship/<ship-id>.json`:

```
.airis/ship/
  ship_abc123_def456.json    # Workflow state
.airis/evidence/
  ship_abc123_proof-report.md   # Proof report
```

Interrupted workflows can be resumed at any time. The state machine tracks:
- Current phase
- Tasks (what was done)
- TODOs (what needs to be done)
- Evidence (artifacts produced)
- Requirements (pass/fail/unverified checks)

## Evidence and Proof Reports

Each completed ship workflow produces a proof report at `.airis/evidence/<ship-id>-proof-report.md` containing:

- Workflow metadata (ID, request, dates)
- Task completion status
- TODO progress
- Evidence artifacts
- Requirements verification table

## Integration with Verified Autonomy

`airis ship` builds on the Verified Autonomy system:

- **Mission contracts** define scope, acceptance criteria, and constraints
- **Capability leases** grant time-bounded permissions
- **Evidence reports** provide cryptographic proof of completion
- **Failure genome** tracks and prevents repeated failed commands

## Example

```bash
$ airis ship start "Add error handling to the CLI"

[contract] Generating mission contract...
[approval] Mission contract ready for review.
  Goal: Add error handling to the CLI
  Acceptance criteria: 5
  Allowed commands: 4
[planning] Creating task plan...
  7 tasks planned
[implementation] Ready for code implementation.
  Manual phase: implement your changes, then run: airis ship resume

# ... make your changes ...

$ airis ship resume

[implementation] Checking for changes...
[formatting] Running format and type checks...
  Format and type checks passed.
[testing] Running tests...
  Build succeeded.
[verification] Running verified autonomy checks...
  All mandatory criteria passed.
[proof] Generating proof report...
  Proof report: .airis/evidence/ship_abc123_proof-report.md

=== Ship Workflow Completed ===
```

## Tips

- Use `airis ship status` frequently to track progress
- The workflow persists across terminal sessions
- Failed formatting/testing can be fixed and resumed
- The proof report is useful for code review and documentation
- Combine with `airis mission` for more granular verification control
