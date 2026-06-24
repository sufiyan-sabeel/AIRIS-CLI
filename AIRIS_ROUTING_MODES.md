# AIRIS Routing Modes

AIRIS uses explicit `@` prefixes to determine the routing mode. Without a prefix, AIRIS behaves as a normal chat assistant.

## Modes

### 1. Normal Chat (no prefix)

Default mode. AIRIS responds as a ChatGPT-style assistant.

Examples:
- `explain a topic`
- `help create a bot`
- `write Instagram script for my app launch`
- `give coding advice`
- `create prompts`
- `answer questions`
- `planning, studying, writing, debugging explanations`

No Android automation. No repo editing. No confirmation requests.

### 2. Automation (`@automation`)

Single-step Android automation.

```
@automation open settings
@automation open WhatsApp
@automation take screenshot
@automation tap 360 800
@automation read screen
@automation scroll down
```

Behavior:
- Runs a single Android automation task.
- Does not edit repo files.
- Does not treat as coding task.

### 3. Coding (`@coding`)

Repository coding and editing tasks.

```
@coding fix npm ci lockfile issue
@coding add feature to auth module
@coding refactor the router logic
@coding write tests for login
```

Behavior:
- Inspects and edits the AIRIS-CLI repo.
- Runs checks if needed.
- Does not control Android.
- Does not trigger Android automation.

### 4. Multi Automation (`@multiauto`)

Multi-step Android automation. Executes immediately without asking for confirmation.

```
@multiauto open WhatsApp, search Sufiyan, open latest chat
@multiauto open settings, scroll down, tap on Display
@multiauto take screenshot and read screen
```

Behavior:
- Executes multi-step automation directly.
- No confirmation loop.
- Stops before risky actions (see Safety Rules below).

## Safety Rules

Even in `@multiauto` mode, AIRIS stops and responds with an error before executing:

- Sending a message
- Making a call (phone or video)
- Deleting files
- Uninstalling apps
- Installing unknown APKs
- Payments or banking actions
- Account login/logout
- Changing security settings
- Entering passwords, OTPs, or credentials
- Factory reset or data wipe

These are defined in `BLOCKED_TERMS` and `CONFIRM_TERMS` in `types.ts`.

## Routing Logs

Each route decision is logged with:
- `ROUTE: CHAT` - normal chat, no action taken
- `ROUTE: AUTOMATION` - single-step Android automation
- `ROUTE: CODING` - repository coding task
- `ROUTE: MULTI_AUTO` - multi-step Android automation

Logs go to `~/.airis/logs/airis.log` via `logCliEvent("route", { mode, taskText })`.

## Examples

```
@automation open settings        # ROUTE: AUTOMATION
@coding fix TypeScript build errors  # ROUTE: CODING
@multiauto open WhatsApp, search Sufiyan, open latest chat  # ROUTE: MULTI_AUTO
normal: write Instagram script for my app launch  # ROUTE: CHAT
```
