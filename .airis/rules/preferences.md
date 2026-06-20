# AIRIS Workspace Preferences

## Configuration
- Keep AIRIS configuration modular and AIRIS-branded.
- Prefer `.airis/` project files and `~/.airis/agent/` user files.
- Do not introduce VS Code extension UI code or unrelated provider dependencies.

## Model/provider profiles
- Use one default model profile unless a task benefits from separate planning and acting profiles.
- Planning profiles should favor reasoning quality.
- Acting profiles should favor reliable tool use, speed, and cost control.
- Store provider names and model IDs as configuration, not hardcoded behavior.

## Memory
- Use `.airis/memory/` only for durable project context that remains useful across sessions.
- Keep `active-context.md` current during long tasks.
- Update memory after milestones, direction changes, or handoffs.
