---
name: termux-api
description: >-
  Use Android device capabilities via Termux:API when running AIRIS in Termux
  (Android terminal emulator). Provides notifications, TTS, clipboard, dialog,
  camera, sensors, location, battery, and storage commands.
---

# Termux:API Skill

Use Android device capabilities via Termux:API when running AIRIS in Termux (Android terminal emulator).

## Prerequisites

- [Termux](https://termux.dev/) installed
- [Termux:API](https://wiki.termux.com/wiki/Termux:API) add-on installed
- `pkg install termux-api` run in Termux

## Available Commands

### Notifications

Send a system notification:

```bash
termux-notification --title "Title" --content "Message text"
```

With buttons:

```bash
termux-notification \
  --title "Alert" \
  --content "Choose an action" \
  --button1 "Open" --button1-action "termux-open-url https://example.com" \
  --button2 "Dismiss" --button2-action "termux-notification-remove \$NOTIFICATION_ID" \
  --priority high
```

Options: `--id` (unique id), `--priority` (high/default/low/min), `--alert-once`, `--group`, `--channel`

### Toast

Show a brief popup:

```bash
termux-toast "Hello world"
termux-toast -s "Short toast"    # short duration
termux-toast -g top               # position: top/middle/bottom (default bottom)
```

### Text-to-Speech

Speak text aloud:

```bash
termux-tts-speak "Hello sir"
termux-tts-speak -r 1.5 "Faster speech"               # rate
termux-tts-speak -p 1.2 "Higher pitch"                # pitch
termux-tts-speak -l "en" "English text"               # language
termux-tts-speak -n "SOME_ENGINE" "Custom engine"     # engine
```

List available TTS engines:

```bash
termux-tts-engines
```

### Vibration

```bash
termux-vibrate                               # default vibration
termux-vibrate -d 500                        # vibrate for 500ms
termux-vibrate -f                           # force vibration (even if silent mode)
```

### Clipboard

```bash
# Copy text to clipboard
echo "text to copy" | termux-clipboard-set
termux-clipboard-set <<< "text to copy"

# Get text from clipboard
termux-clipboard-get
```

### Dialog / Input

```bash
# Text input dialog
termux-dialog text -i "default" -t "Enter your name"

# Confirm dialog (returns JSON with { "text": "yes" } or { "text": "" })
termux-dialog confirm -t "Continue?" -i "Are you sure?"

# List selection (returns JSON)
termux-dialog sheet -t "Select an option" -v "Option1,Option2,Option3"

# Radio/Checkbox
termux-dialog radio -t "Pick one" -v "A,B,C"
termux-dialog checkbox -t "Pick multiple" -v "A,B,C"

# Date/Time picker
termux-dialog date
termux-dialog time
termux-dialog counter -t "Set count" -i "0" --min "0" --max "100"
```

### Open URL

```bash
termux-open-url "https://github.com/sufiyan-sabeel/AIRIS-CLI"
```

### Share

```bash
termux-share -a "text to share"              # share text
termux-share -f /path/to/file                # share file
termux-share -c "Custom chooser title" -a "text"
```

### Storage / File Access

```bash
# Request storage permission
termux-setup-storage

# Get file from storage
termux-storage-get -o /path/output.txt

# Media scan
termux-media-scan -f /path/to/file
```

### Battery Status

```bash
termux-battery-status       # returns JSON: health, percentage, plugged, temperature, etc.
```

### Sensor Data

```bash
termux-sensor -s "Accelerometer" -n 1       # single reading
termux-sensor -c                             # clean-up sensors
termux-sensor -l                             # list available sensors
termux-sensor -d 100                          # delay between readings in ms
```

### Location

```bash
termux-location -p gps                       # provider: gps/network/passive
termux-location -r last                      # request: single/update/last
```

### Camera

```bash
termux-camera-photo -c 0 /sdcard/photo.jpg   # camera ID 0 (back) or 1 (front)
termux-camera-info                            # list cameras
```

### Device Info

```bash
termux-telephony-deviceinfo                  # IMEI, network, etc.
termux-telephony-cellinfo                    # cell tower info
termux-wifi-connectioninfo                   # WiFi info
termux-wifi-scaninfo                         # scan networks
termux-audio-info                            # audio info
termux-brightness 200                        # set brightness (0-255)
```

## ADB Automation (Included)

AIRIS includes an **ADB automation extension** at `.airis/extensions/adb-automation.ts` that provides direct shell-based ADB commands (no Python required). It registers these tools:

### ADB Tools

| Tool Name | Description |
|-----------|-------------|
| `check-device` | Check device connection and screen info |
| `adb-tap` | Tap at coordinates `(x, y)` |
| `adb-swipe` | Swipe from `(x1,y1)` to `(x2,y2)` |
| `adb-input-text` | Type text into focused field |
| `adb-keyevent` | Send key event (HOME=3, BACK=4, ENTER=66, etc.) |
| `adb-open-app` | Open app by name or package |
| `adb-screenshot` | Take a screenshot |
| `adb-battery` | Check battery level, temp, charging status |
| `adb-dump-ui` | Dump UI hierarchy XML |

### Termux:API Tools

| Tool Name | Description |
|-----------|-------------|
| `termux-notify` | Send notification with title, content, priority |
| `termux-toast` | Show brief popup |
| `termux-tts` | Speak text aloud |
| `termux-clipboard` | Copy text to clipboard |
| `termux-vibrate` | Vibrate device |

All tools are loaded from `.airis/extensions/adb-automation.ts`. They work without the Python bridge.

## Example: AIRIS Extension Using Termux API

Create `.airis/extensions/termux-notify.ts`:

```typescript
import type { ExtensionAPI, ExtensionContext } from "@sufiyan-sabeel/airis-cli";
import { Type } from "@earendil-works/airis-ai";

const notifyTool = {
	name: "termux-notify",
	label: "Termux Notify",
	description: "Send Android notification via Termux:API",
	parameters: Type.Object({
		title: Type.String({ description: "Notification title" }),
		content: Type.String({ description: "Notification body text" }),
		priority: Type.Optional(Type.String({ enum: ["high", "default", "low", "min"] })),
	}),
	async execute(_toolCallId: string, params: { title: string; content: string; priority?: string }, _signal: AbortSignal, _onUpdate: unknown) {
		const args = [`--title`, params.title, `--content`, params.content];
		if (params.priority) args.push(`--priority`, params.priority);

		const { execSync } = await import("child_process");
		execSync("termux-notification", args, { stdio: "ignore" });

		return { content: [{ type: "text", text: `Notification sent: ${params.title}` }] };
	},
};

export default function (airis: ExtensionAPI) {
	airis.registerTool(notifyTool);
}
```

## Usage in Skills

When AIRIS runs in Termux, use these commands for:

- **`termux-notification`**: Alert user about long-running task completion, errors, or important info
- **`termux-toast`**: Quick visual feedback for status updates
- **`termux-tts-speak`**: Read responses aloud
- **`termux-clipboard-set`**: Copy code blocks or results to clipboard
- **`termux-open-url`**: Open GitHub links, PRs, or docs
- **`termux-vibrate`**: Haptic feedback for task completion

## Notes

- All commands are synchronous in shell context
- JSON output commands (`termux-battery-status`, `termux-sensor`, `termux-location`) can be piped to `jq` for parsing
- Termux:API app must be installed alongside Termux
- Storage access requires `termux-setup-storage` to be run once
