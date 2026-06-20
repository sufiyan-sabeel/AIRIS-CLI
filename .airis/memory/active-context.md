# Active Context

Current focus: AIRIS-branded, modular safety and workflow preferences inspired by Cline concepts.

Recent decisions:
- Keep additions reversible and isolated.
- Add new AIRIS files only.
- Do not wire changes into CLI startup or UI until explicitly requested.
- Treat project trust, safe tool execution, planning, model profiles, workspace rules, file editing safety, approval modes, and memory as configuration concepts.

Next steps:
- Review the example config.
- Decide whether to wire `airis-workflow-preferences.ts` into existing settings, prompts, or tool approval flows.
