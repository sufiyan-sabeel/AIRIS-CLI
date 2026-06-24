# AIRIS Claude Reference Upgrade

This upgrade uses the Claude reference repository only for CLI UX inspiration: concise onboarding, explicit trusted-folder language, and clear permission/safety wording. No Claude branding, code, or architecture is copied into AIRIS.

## Claude reference ideas inspected

- Start from the project directory and make the current workspace obvious.
- Explain safety and permissions before enabling workspace actions.
- Prefer short startup guidance over dense option lists.
- Keep risky or destructive actions gated even when a workspace is trusted.

## AIRIS implementation

### Welcome screen

AIRIS startup now uses `packages/coding-agent/src/core/airis-welcome.ts` as the AIRIS-branded welcome model. It provides:

- AIRIS terminal logo.
- “Mobile-first AI CLI for coding and Android automation”.
- Current project path.
- Modes: normal chat, `@coding`, `@automation`, `@multiauto`.
- “Built by Umaiz Sufiyan”.

The interactive startup header receives this model from `packages/coding-agent/src/main.ts` and renders it in `packages/coding-agent/src/modes/interactive/interactive-mode.ts`.

### Trust folder onboarding

AIRIS keeps the existing trust manager and project-trust decision store. The wrapper in `packages/coding-agent/src/core/airis-trust-onboarding.ts` delegates to the existing trust resolver instead of duplicating trust logic.

Trust decisions continue to be stored by the existing `ProjectTrustStore` in `~/.airis/agent/trust.json` unless `AIRIS_CODING_AGENT_DIR` overrides the agent directory.

Trusted means:

- AIRIS can read and edit files in this repository.
- AIRIS can run safe checks and project-local commands.
- AIRIS can load project-local settings, skills, prompts, themes, and extensions.
- AIRIS still asks before risky or destructive actions.

Commands:

```bash
airis trust
airis trust list
airis trust revoke <path>
airis --approve
airis --no-approve
```

## What was not changed

- AIRIS name and branding.
- Existing CLI commands and session behavior.
- Android automation logic.
- Extension, skills, theme, and prompt-template systems.
- No Telegram, voice assistant, or dashboard was added.

## Validation commands

```bash
npm run check
```

If local dependency executables are missing, fix the local install first with `npm install --ignore-scripts` and rerun the check.

Built by Umaiz Sufiyan
