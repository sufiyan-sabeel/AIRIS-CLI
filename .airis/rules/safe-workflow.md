# AIRIS Safe Workflow Preferences

These rules adapt useful safe-workflow ideas for AIRIS without changing AIRIS commands, branding, package layout, or UI.

## Project trust
- Ask before loading or acting on project-local resources in untrusted workspaces.
- Treat `.airis/settings.json`, `.airis/extensions`, `.airis/skills`, `.airis/prompts`, `.airis/themes`, `SYSTEM.md`, and `APPEND_SYSTEM.md` as trust-gated resources.
- Prefer session-only trust when evaluating unfamiliar repositories.

## Tool execution
- Read-only inspection can proceed without extra approval in trusted workspaces.
- Ask before network access, package installation, credential access, or destructive shell commands.
- Do not run commands matching destructive patterns such as `git reset --hard`, `git clean -fd`, broad `rm -rf`, or shell-piped installers unless the user explicitly approves.

## File editing
- Read a file before editing it.
- Prefer targeted patch edits over full rewrites.
- Do not overwrite generated, lockfile, binary, or large files unless the user explicitly asks.
- Keep edits small, reviewable, and reversible.

## Planning
- For multi-file, risky, or unclear work, produce a short plan before changing files.
- Use plan-only behavior while investigating architecture, debugging uncertain issues, or reviewing security-sensitive changes.
- Switch to implementation only after the plan is clear or the user approves it.
