# AIRIS Cline-Inspired Integration

This integration extracts useful workflow ideas from `https://github.com/cline/cline.git` and adapts them to AIRIS naming and structure.

## What was added

- `packages/coding-agent/src/core/airis-workflow-preferences.ts`
  - Standalone AIRIS preference types, defaults, merge logic, and loader.
  - Reads optional global preferences from `~/.airis/agent/workflow-preferences.json`.
  - Reads optional trusted project preferences from `.airis/workflow-preferences.json`.
- `.airis/airis-workflow-preferences.example.json`
  - Example config covering trust, approvals, tool safety, editing safety, planning, model profiles, workspace rules, and memory.
- `.airis/rules/safe-workflow.md`
  - AIRIS workspace rules for trust, safe tools, safe edits, and planning.
- `.airis/rules/preferences.md`
  - AIRIS workspace preferences for modular configuration, model profiles, and memory.
- `.airis/memory/README.md`
  - Optional AIRIS memory structure.
- `.airis/memory/project-brief.md`
  - Initial project brief template.
- `.airis/memory/active-context.md`
  - Current context template.

## Cline concepts adapted to AIRIS

- Project trust confirmation.
- Safe tool execution preferences.
- Approval modes.
- Model/provider profile structure.
- Workspace rules/preferences.
- Plan-first task behavior.
- File editing safety rules.
- Optional memory/preferences files.

## What was intentionally skipped

- VS Code extension UI code.
- Cline branding, commands, and entrypoints.
- Large new dependencies.
- Automatic rewiring of AIRIS startup, package layout, CLI commands, or TUI behavior.
- Replacing existing AIRIS settings, trust, tool, or session managers.

## Usage

To try the project-level preferences, copy the example file:

```bash
cp .airis/airis-workflow-preferences.example.json .airis/workflow-preferences.json
```

Then adjust values as needed. The new TypeScript module can load preferences with:

```ts
import { loadAirisWorkflowPreferences } from "./core/airis-workflow-preferences.ts";

const preferences = loadAirisWorkflowPreferences(process.cwd(), { projectTrusted: true });
```

## Safety notes

These additions are modular and reversible. They do not change AIRIS runtime behavior until existing AIRIS code explicitly imports and uses the new module.
