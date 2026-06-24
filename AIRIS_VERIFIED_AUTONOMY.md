# AIRIS Verified Autonomy

AIRIS Verified Autonomy adds mission contracts, scoped capability leases and evidence-backed completion checks.

## Workflow

```bash
airis mission "Build the requested feature" --verified
airis mission approve <mission-id>
airis mission run <mission-id>
airis evidence show <mission-id>
```

A mission starts as a draft contract in `.airis/missions/`. Review the goal, requirements, non-goals, constraints, acceptance criteria, allowed directories, allowed commands, budgets and verification strategy before approval.

Approving a mission creates a temporary capability lease in `.airis/leases.json`. The verifier only runs commands that match the active lease, from directories inside the lease scope. Destructive commands such as `rm -rf`, `git reset --hard`, `git clean -fd`, `dd`, `mkfs`, recursive ownership changes and similar commands are blocked by default.

## Evidence

`airis mission run <id>` writes `.airis/evidence/<mission-id>.json` with:

- criterion ID
- verification method
- evidence source
- timestamp
- pass, fail or unverified status
- confidence score
- command exit codes and redacted output previews
- SHA-256 hashes of evidence artifacts

AIRIS reports `completed` only when every mandatory criterion has passing evidence. Failed mandatory criteria produce `failed`. Unverified mandatory criteria produce `partially_completed`.

## Failure Genome

Failed verification commands are fingerprinted under `.airis/failures/`. Before AIRIS retries a command, it checks whether the same command already failed for the current workspace fingerprint and skips repeated attempts until new evidence exists.

```bash
airis failures search "typescript"
airis lease list
airis lease revoke <lease-id>
```

Secrets are redacted before evidence and failure records are persisted.
