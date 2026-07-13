# Web AIRIS — TypeScript Web IDE for Mobile & Desktop

> **Build-first plan**: Create a TypeScript website IDE (like Cursor in the browser) that runs on mobile and desktop via PWA. Reuses AIRIS-CLI's existing TypeScript packages directly with a React/Monaco frontend.

---

## Why TypeScript Web First?

AIRIS-CLI is already **100% TypeScript** across all packages (`agent`, `ai`, `coding-agent`, `tui`). A web IDE built in TypeScript can:

- **Reuse AIRIS-CLI packages directly** — no porting to Kotlin/Swift
- **Run same provider abstraction, tool system, session management** — the core engine unchanged
- **PWA for mobile** — installable on Android/iOS from browser, works offline
- **Desktop via browser** — full IDE experience on any OS
- **WebSocket backend** — connect to local machine or remote dev server for file access, terminal, git

---

## Architecture: Reuse AIRIS-CLI + Web Frontend

```
┌─────────────────────────────────────────────────────────┐
│                     Web AIRIS IDE                        │
│                                                         │
│  ┌─────────────────────┐    ┌────────────────────────┐  │
│  │  Frontend (React)   │    │  Backend (Node.js)     │  │
│  │                     │    │                        │  │
│  │  Monaco Editor      │◄──►│   AIRIS packages:      │  │
│  │  Chat Panel         │    │   ├── @agent           │  │
│  │  File Tree          │    │   ├── @ai (providers)  │  │
│  │  Diff Viewer        │    │   ├── @coding-agent    │  │
│  │  Terminal Emulator  │    │   │   (tools, sessions, │  │
│  │  Settings UI        │    │   │    self-debug,     │  │
│  │                     │    │   │    extensions,     │  │
│  │  PWA (service       │    │   │    skills)         │  │
│  │   worker)           │    │   └── @tui             │  │
│  └─────────────────────┘    │        (themes,        │  │
│               │             │         keybindings)   │  │
│               │ WebSocket   │                        │  │
│               │ / REST      │  ┌──────────────────┐  │  │
│               ▼             │  │ File System      │  │  │
│  ┌─────────────────────┐    │  │ (local/remote)   │  │  │
│  │  Client-side        │    │  ├──────────────────┤  │  │
│  │  IndexedDB          │    │  │ Git integration  │  │  │
│  │  (offline sessions) │    │  ├──────────────────┤  │  │
│  │  + Cache            │    │  │ Terminal (xterm) │  │  │
│  └─────────────────────┘    │  └──────────────────┘  │
│                             └────────────────────────┘
└─────────────────────────────────────────────────────────┘
```

### Package Reuse Strategy

| AIRIS Package | Web IDE Usage | Changes Needed |
|---------------|--------------|----------------|
| `@sufiyan-sabeel/airis-ai` | **Reuse unchanged** — provider registry, streaming, model metadata | None (headless) |
| `@sufiyan-sabeel/airis-agent-core` | **Reuse unchanged** — agent loop, state management | None (headless) |
| `@sufiyan-sabeel/airis-tui` | **Themes & keybindings** — tokens, schemas | Skip terminal rendering, use token/theme JSON only |
| `@sufiyan-sabeel/airis-cli` | **Core engine** — sessions, tools, extensions, skills, self-debug | Replace TUI I/O with WebSocket I/O |

**File edit engine** (`edit` tool with exact-match replacement) — reused directly from `@coding-agent`, exposed via WebSocket.

**Self-debug system** (`SelfDebugBrain`) — reused directly, error analysis pipeline unchanged.

---

## Repo Structure: Monorepo with AIRIS as Dependency

```
airis-web-ide/
├── packages/
│   ├── web-backend/          # Node.js backend (reuses @sufiyan-sabeel/* packages)
│   │   ├── src/
│   │   │   ├── index.ts          # Fastify/Express + WebSocket server
│   │   │   ├── project-manager.ts # Open/manage local or remote projects
│   │   │   ├── agent-bridge.ts   # Wraps AIRIS AgentSession for WS transport
│   │   │   ├── file-system.ts    # FS operations with permission sandbox
│   │   │   ├── git-service.ts    # Git operations via isomorphic-git / exec
│   │   │   ├── terminal.ts       # PTY (node-pty) for embedded terminal
│   │   │   └── auth.ts           # Provider credential storage
│   │   ├── package.json          # deps: @sufiyan-sabeel/airis-* packages
│   │   └── tsconfig.json
│   │
│   ├── web-frontend/         # React SPA + PWA (mobile & desktop)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── editor/
│   │   │   │   ├── MonacoEditor.tsx     # Code editor (Monaco via @monaco-editor/react)
│   │   │   │   ├── DiffViewer.tsx       # Side-by-side / unified diff
│   │   │   │   └── FileTree.tsx         # File explorer
│   │   │   ├── chat/
│   │   │   │   ├── ChatPanel.tsx        # AI conversation panel
│   │   │   │   ├── Message.tsx          # Markdown + code block rendering
│   │   │   │   └── PromptInput.tsx      # Input bar with @file autocomplete
│   │   │   ├── terminal/
│   │   │   │   └── Terminal.tsx         # xterm.js terminal widget
│   │   │   ├── panels/
│   │   │   │   ├── Layout.tsx           # Split panel (editor/chat/terminal)
│   │   │   │   ├── MobileLayout.tsx     # Tab-based layout for mobile
│   │   │   │   └── Panel.tsx            # Resizable panel container
│   │   │   ├── settings/
│   │   │   │   ├── SettingsDialog.tsx   # Provider config, theme, etc.
│   │   │   │   └── ModelPicker.tsx      # Provider + model selector
│   │   │   ├── services/
│   │   │   │   ├── websocket.ts         # WS connection to backend
│   │   │   │   ├── session-store.ts     # IndexedDB session persistence
│   │   │   │   └── file-cache.ts        # Client-side file cache
│   │   │   ├── hooks/
│   │   │   │   ├── useAgentSession.ts   # Agent session hook
│   │   │   │   ├── useFileSystem.ts     # File ops hook
│   │   │   │   └── useTheme.ts          # Theme token hook
│   │   │   └── pwa/
│   │   │       ├── service-worker.ts    # Offline cache, background sync
│   │   │       └── manifest.ts          # PWA manifest
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── index.html         # PWA entry
│   │   └── vite.config.ts     # Vite build + PWA plugin
│   │
│   └── shared/                # Shared types between frontend & backend
│       ├── src/
│       │   ├── types.ts           # RPC message types
│       │   ├── protocol.ts        # WebSocket message protocol
│       │   └── index.ts
│       └── package.json
│
├── package.json               # Root workspace config
├── tsconfig.base.json
└── README.md
```

---

## Phase 1 — Build-First Plan (Week 1–2)

### Step 1: Scaffold Monorepo

```bash
mkdir airis-web-ide && cd airis-web-ide
npm init -w packages/shared
npm init -w packages/web-backend
npm init -w packages/web-frontend
```

**Root `package.json`:**
```json
{
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w packages/web-backend\" \"npm run dev -w packages/web-frontend\"",
    "build": "npm run build -w packages/shared && npm run build -w packages/web-backend && npm run build -w packages/web-frontend",
    "check": "tsc --noEmit -p tsconfig.json"
  }
}
```

**Dev experience:**
```bash
npm run dev           # Starts both backend (port 3001) + frontend (port 5173)
# Open http://localhost:5173 on desktop
# Open http://<LAN-IP>:5173 on mobile browser → "Add to Home Screen"
```

### Step 2: Backend — Wrap AIRIS-CLI Agent

```typescript
// packages/web-backend/src/agent-bridge.ts
import { AgentSession } from "@sufiyan-sabeel/airis-cli";
import { WebSocket } from "ws";

export class AgentBridge {
  private sessions = new Map<string, AgentSession>();

  async createSession(params: {
    projectDir: string;
    provider: string;
    model: string;
    apiKey?: string;
  }): Promise<string> {
    const session = new AgentSession({
      projectDir: params.projectDir,
      provider: params.provider,
      model: params.model,
      apiKey: params.apiKey,
      // Tool I/O is overridden to send via WebSocket instead of terminal
      toolIO: new WebSocketToolIO(),
    });
    const id = crypto.randomUUID();
    this.sessions.set(id, session);
    return id;
  }

  async handleMessage(ws: WebSocket, msg: ClientMessage) {
    switch (msg.type) {
      case "prompt":
        const session = this.sessions.get(msg.sessionId)!;
        // Stream response back through WS
        for await (const chunk of session.processPrompt(msg.text)) {
          ws.send(JSON.stringify({ type: "chunk", data: chunk }));
        }
        break;
      case "read_file":
        const content = await fs.readFile(msg.path, "utf-8");
        ws.send(JSON.stringify({ type: "file_content", path: msg.path, content }));
        break;
      case "edit_file":
        const result = await this.applyEdit(msg.sessionId, msg.path, msg.edits);
        ws.send(JSON.stringify({ type: "edit_result", ...result }));
        break;
    }
  }
}
```

### Step 3: Frontend — Monaco Editor + Chat

```typescript
// packages/web-frontend/src/editor/MonacoEditor.tsx
import Editor, { OnMount } from "@monaco-editor/react";

export function MonacoEditor({ file, sessionId }: Props) {
  const [content, setContent] = useState("");
  const ws = useWebSocket();

  // On mount, load file content via WS
  useEffect(() => {
    ws.send(JSON.stringify({ type: "read_file", path: file.path }));
    ws.onMessage((msg) => {
      if (msg.type === "file_content" && msg.path === file.path) {
        setContent(msg.content);
      }
    });
  }, [file.path]);

  return (
    <Editor
      height="100%"
      language={file.language}
      value={content}
      onChange={(val) => setContent(val ?? "")}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        // Touch-friendly: larger line height on mobile
        lineHeight: window.innerWidth < 768 ? 24 : 20,
      }}
    />
  );
}
```

```typescript
// packages/web-frontend/src/chat/ChatPanel.tsx
export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const ws = useWebSocket();

  const sendPrompt = () => {
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, role: "user", content: input }]);
    ws.send(JSON.stringify({ type: "prompt", text: input }));

    ws.onMessage((msg) => {
      if (msg.type === "chunk") {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last.role === "assistant") {
            return [...m.slice(0, -1), { ...last, content: last.content + msg.data }];
          }
          return [...m, { id, role: "assistant", content: msg.data }];
        });
      }
      if (msg.type === "code_diff") {
        // Show diff overlay in editor
        dispatch({ type: "show_diff", file: msg.file, diff: msg.diff });
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2">
        {messages.map((msg) => (
          <MessageBlock key={msg.id} message={msg} />
        ))}
      </div>
      <PromptInput
        value={input}
        onChange={setInput}
        onSubmit={sendPrompt}
        // @file autocomplete from project file tree
        onFileRef={(file) => setInput((i) => i + ` @${file.path}`)}
      />
    </div>
  );
}
```

### Step 4: Responsive Layout — Mobile & Desktop

```typescript
// packages/web-frontend/src/panels/Layout.tsx
import { useMediaQuery } from "../hooks/useMediaQuery";

export function Layout() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return <MobileLayout />;
  }
  return <DesktopLayout />;
}

// Desktop: side-by-side
function DesktopLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar> {/* File tree, extensions */}
        <FileTree />
      </Sidebar>
      <div className="flex-1 flex">
        <Panel defaultSize={60}>
          <MonacoEditor />
        </Panel>
        <Panel defaultSize={40}>
          <TabBar tabs={["Chat", "Terminal", "Problems"]} />
          <ChatPanel />
        </Panel>
      </div>
      <StatusBar />
    </div>
  );
}

// Mobile: tab-based, single panel at a time
function MobileLayout() {
  const [tab, setTab] = useState<"editor" | "chat" | "explorer">("editor");

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1">
        {tab === "editor" && <MonacoEditor />}
        {tab === "chat" && <ChatPanel />}
        {tab === "explorer" && <FileTree />}
      </div>
      {/* Bottom navigation bar */}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
```

### Step 5: PWA — Installable on Mobile

```typescript
// packages/web-frontend/vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Web AIRIS IDE",
        short_name: "AIRIS",
        description: "AI-powered web IDE",
        theme_color: "#1e1e2e",
        background_color: "#1e1e2e",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          // Cache API responses for offline
          { urlPattern: /^https?:\/\/.*\/api\/.*/, handler: "NetworkFirst" },
        ],
      },
    }),
  ],
});
```

---

## Full Feature Map: AIRIS-CLI → Web AIRIS IDE

| # | AIRIS-CLI Feature | Web AIRIS Implementation | Mobile | Desktop | Build Phase |
|---|-------------------|-------------------------|--------|---------|-------------|
| 1 | **Interactive AI Chat** | Chat panel with streaming markdown + code blocks | ✅ Tab | ✅ Side panel | P1 |
| 2 | **One-shot prompts** | Quick prompt from command palette (Ctrl+K / Cmd+K) | ✅ Gesture | ✅ Shortcut | P1 |
| 3 | **File-aware `@file`** | `@` autocomplete → file picker → content in context | ✅ Chips UI | ✅ Autocomplete | P1 |
| 4 | **Multi-provider** | Reuse `@sufiyan-sabeel/airis-ai` unchanged | ✅ | ✅ | P1 |
| 5 | **read / bash / edit / write tools** | WS protocol → backend AIRIS tool execution | ✅ | ✅ | P1 |
| 6 | **Session management** | IndexedDB for client + server SQLite | ✅ Offline | ✅ Server | P1 |
| 7 | **Code generation** | Monaco editor + diff viewer + apply/reject | ✅ | ✅ | P1 |
| 8 | **Diff preview** | Monaco diff editor component | ✅ Modal | ✅ Inline | P1 |
| 9 | **File tree** | Custom tree component with context menu | ✅ Drawer | ✅ Sidebar | P1 |
| 10 | **Terminal** | xterm.js in browser, node-pty on server | ✅ Tab | ✅ Panel | P2 |
| 11 | **Project trust** | Permission dialog per tool call | ✅ | ✅ | P2 |
| 12 | **Extensions** | Load `.airis/extensions/*.ts` on backend | ✅ | ✅ | P2 |
| 13 | **Skills** | `/skill` commands, same `.airis/skills/` format | ✅ | ✅ | P2 |
| 14 | **Themes** | CSS variables from AIRIS 51 tokens + metadata | ✅ | ✅ | P2 |
| 15 | **Self-debug** | Reuse `SelfDebugBrain` → error analysis UI | ✅ | ✅ | P2 |
| 16 | **Git integration** | isomorphic-git for web, or local git via backend | ✅ | ✅ | P2 |
| 17 | **Inline completions** | Monaco `InMemoryEditor` + AI suggestion provider | ✅ Ghost text | ✅ | P3 |
| 18 | **Model routing** | Reuse AIRIS model resolution logic | ✅ | ✅ | P3 |
| 19 | **ADB / Automation** | WebUSB ADB or backend ADB bridge | ✅ | ✅ | P3 |
| 20 | **Image generation** | Image via provider or backend ComfyUI | ✅ | ✅ | P3 |
| 21 | **Vision** | File upload → base64 → provider vision API | ✅ Camera | ✅ Drag | P3 |
| 22 | **Extensions marketplace** | Package registry UI for `.airis/extensions/` | ✅ | ✅ | P4 |
| 23 | **Multi-device sync** | WebRTC / server-based session sync | ✅ | ✅ | P4 |

---

## Mobile UI: Touch-Optimized Layouts

### Portrait Phone

```
┌─────────────────────┐
│  Status Bar         │
├─────────────────────┤
│                      │
│  [Active Panel]      │
│                      │
│  Editor / Chat /     │
│  Explorer / Terminal │
│                      │
├─────────────────────┤
│ 📁  💬  ⌨️  ⚙️  🐚 │  ← Bottom nav
└─────────────────────┘
```

| Gesture | Action |
|---------|--------|
| Swipe left on file | AI action menu (explain, refactor, generate test) |
| Swipe right on line | Copy line, explain line |
| Long-press code | Select + contextual AI actions |
| Pinch | Zoom font size |
| Edge swipe | Switch between editor/chat/explorer |
| Tap @ in input | Show file autocomplete sheet |
| Pull to refresh | Regenerate last AI response |

### Landscape / Tablet

```
┌──────────────────────────────┬─────────────────────────────┐
│  File Tree                    │  Chat Panel                │
│  ┌──────────────────────┐    │  ┌───────────────────────┐  │
│  │ src/                  │    │  │ User: refactor this   │  │
│  │ ├─ components/        │    │  │ AI: Sure, here's...  │  │
│  │ ├─ App.tsx            │    │  │ ┌──────────────────┐ │  │
│  │ └─ index.ts           │    │  │ │  Code diff...    │ │  │
│  └──────────────────────┘    │  │ │ [Apply] [Reject] │ │  │
│                               │  │ └──────────────────┘ │  │
│                               │  └───────────────────────┘  │
├──────────────────────────────┴─────────────────────────────┤
│  Terminals / Problems / Output                             │
└────────────────────────────────────────────────────────────┘
```

### Desktop

```
┌──────┬─────────────────────────────────┬────────────────────┐
│ File  │  [Editor Tab Bar]               │  Chat              │
│ Tree  │  ┌─────────────────────────┐    │  ┌──────────────┐ │
│       │  │  Monaco Editor          │    │  │ Prompt input │ │
│       │  │                         │    │  │              │ │
│       │  │  Code with syntax       │    │  │ AI responses │ │
│       │  │  highlighting           │    │  │ with diffs   │ │
│       │  │                         │    │  │              │ │
│       │  │  Inline completions     │    │  │ /commands    │ │
│       │  │  (ghost text)           │    │  │              │ │
│       │  └─────────────────────────┘    │  └──────────────┘ │
│       ├─────────────────────────────────┤  ┌──────────────┐ │
│       │  Terminal (xterm.js)            │  │ Problems     │ │
│       └─────────────────────────────────┘  └──────────────┘ │
├──────┴─────────────────────────────────┴────────────────────┤
│  Status: main ▲  branch  │  Gemini 2.5 Pro  │  Lint: 0 err  │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Code Generation Pipeline (Web)

```
Mobile/Desktop Browser                    Node.js Backend
┌──────────────────┐                     ┌────────────────────────┐
│ User types       │                     │                        │
│ "Create login    │── WS JSON ─────────▶│  AgentSession          │
│  screen"         │                     │  │                    │
│                  │                     │  ├── Analyze project   │
│ Spinner +        │◀─ stream chunks ────│  ├── Call LLM provider │
| partial render   |                     │  ├── Parse code blocks │
│                  │                     │  └── Generate diff     │
│ Diff overlay     │◀─ edit_result ──────│                        │
│ ┌──────────────┐│                     └────────────────────────┘
│ │ + new file   ││
│ │ LoginScreen  ││
│ │ .tsx         ││
│ │              ││
│ │ [Apply]      ││
│ └──────────────┘│
└──────────────────┘
```

**WebSocket Protocol:**

```typescript
// packages/shared/src/protocol.ts

// Client → Server
type ClientMessage =
  | { type: "prompt"; sessionId: string; text: string; files?: string[] }
  | { type: "read_file"; path: string }
  | { type: "write_file"; path: string; content: string }
  | { type: "edit_file"; path: string; edits: { oldText: string; newText: string }[] }
  | { type: "run_command"; command: string; cwd?: string }
  | { type: "list_files"; path: string; pattern?: string }
  | { type: "create_session"; projectDir: string; provider: string; model: string }
  | { type: "get_diff"; path: string };

// Server → Client
type ServerMessage =
  | { type: "chunk"; data: string; sessionId: string }
  | { type: "code_block"; language: string; code: string; filePath?: string }
  | { type: "edit_result"; path: string; diff: DiffLine[]; success: boolean }
  | { type: "file_content"; path: string; content: string }
  | { type: "session_created"; sessionId: string }
  | { type: "error"; message: string; code?: string }
  | { type: "tool_call"; tool: string; params: Record<string, unknown>; id: string }
  | { type: "tool_result"; id: string; output: string }
  | { type: "terminal_output"; data: string }
  | { type: "permission_request"; tool: string; path?: string; id: string };

type DiffLine = { type: "added" | "removed" | "unchanged"; content: string; lineNumber: number };
```

---

## Backend: Wrapping AIRIS-CLI

```typescript
// packages/web-backend/src/index.ts
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { AgentBridge } from "./agent-bridge";
import { ProjectManager } from "./project-manager";

const app = Fastify();
const wss = new WebSocketServer({ port: 3002 });
const bridge = new AgentBridge();
const projects = new ProjectManager();

// REST endpoints for CRUD operations
app.get("/api/projects", async () => projects.list());
app.post("/api/projects", async (req) => projects.create(req.body));
app.get("/api/projects/:id/files/*", async (req) => {
  const content = await projects.readFile(req.params["*"]);
  return { content };
});

// WebSocket for real-time agent interaction
wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());
    await bridge.handleMessage(ws, msg);
  });
});

app.listen({ port: 3001 });
```

---

## Core Data Models (Web)

```typescript
// packages/shared/src/types.ts

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  language: string;
  framework?: string;
  createdAt: number;
  lastOpened: number;
  trusted: boolean;
}

export interface Session {
  id: string;
  projectId: string;
  name: string;
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tokenCount: number;
  // Client-side: stored in IndexedDB for offline access
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string; // Markdown with code blocks
  filesReferenced: string[];
  generatedFiles: GeneratedFile[];
  timestamp: number;
  tokenCount: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  applied: boolean;
  diff: DiffLine[];
  language: string;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
  oldLineNumber?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiType: "openai" | "anthropic" | "gemini" | "mistral" | "bedrock" | "custom";
  baseUrl?: string;
  defaultModel: string;
  isDefault: boolean;
  // API key stored in backend env or encrypted client storage
}

export interface TrustSettings {
  projectId: string;
  level: "full" | "read_write" | "read_only" | "none";
  tools: string[]; // Allowed tool names
  expiresAt?: number;
}
```

---

## Offline Support (PWA)

```
Browser                            Service Worker
┌──────────────┐                  ┌──────────────────────┐
│  App Shell   │◀─ cache first ──│  Pre-cached assets    │
│  (HTML, CSS, │                  │  (monaco-editor, app) │
│   JS icons)  │                  └──────────────────────┘
│              │                  ┌──────────────────────┐
│  Sessions    │◀─ IndexedDB ────│  Message history      │
│  (offline    │                  │  (last 50 sessions)  │
│   read)      │                  │  + file cache         │
│              │                  └──────────────────────┘
│              │                  ┌──────────────────────┐
│  Queue       │──▶ background ──│  Pending prompts      │
│  (offline    │     sync        │  queued for later     │
│   write)     │                  │  when online          │
└──────────────┘                  └──────────────────────┘
```

---

## Build Phase 1 — Minimum Viable Product

### What ships in Phase 1:

| Deliverable | Description | Mobile? | Desktop? |
|-------------|-------------|---------|----------|
| Monorepo scaffold | Workspace, shared types, Vite dev server | — | — |
| Backend server | Fastify + WS, wraps AgentSession with 1 provider | — | — |
| Monaco editor | Read/write files, syntax highlighting | ✅ | ✅ |
| Chat panel | Stream prompts, render markdown + code | ✅ | ✅ |
| Diff viewer | Show AI-generated code diffs with apply/reject | ✅ | ✅ |
| File tree | Browse project files, open in editor | ✅ | ✅ |
| Responsive layout | Mobile tabs + desktop split panels | ✅ | ✅ |
| PWA manifest | Installable, offline shell | ✅ | — |
| Multi-provider | Reuse AIRIS `@ai` package directly | ✅ | ✅ |
| Session save | IndexedDB persistence | ✅ | ✅ |

### What's NOT in Phase 1 (deferred):

- Terminal emulator (xterm.js)
- Git integration
- Inline completions (ghost text)
- ADB/automation
- Extensions marketplace
- Skills store
- Multi-device sync

---

## Quick Start (Phase 1 dev loop)

```bash
# 1. Clone and install
git clone https://github.com/your-org/airis-web-ide.git
cd airis-web-ide
npm install --ignore-scripts

# 2. Set provider key (reuses AIRIS env vars)
export GEMINI_AAIRIS_KEY="your-key"

# 3. Start both backend + frontend
npm run dev

# 4. Open in browser
#    Desktop: http://localhost:5173
#    Mobile:  http://<LAN-IP>:5173 → "Add to Home Screen"

# 5. Open a project
#    Click "Open Project" → select local directory (or clone from URL)
#    Start prompting: "Add a login form to App.tsx"
```

---

## Comparison: AIRIS-CLI vs Web AIRIS vs Cursor

| Feature | AIRIS-CLI (Terminal) | Web AIRIS (Browser) | Cursor (Desktop) |
|---------|---------------------|---------------------|------------------|
| Platform | Terminal (any OS) | Any browser + PWA | macOS, Windows, Linux |
| Mobile support | ✅ Termux | ✅ PWA | ❌ |
| AI providers | 20+ | Same (reuses `@ai`) | Limited (OpenAI, Claude) |
| Code editing | `edit` tool (text) | Monaco editor (AST-aware) | VS Code fork |
| File system | Local FS | Local + remote FS | Local FS |
| Git integration | Shell commands | UI + backend git | Built-in |
| Extensions | TypeScript plugins | Same format + Web UI | VS Code extensions |
| Sessions | JSON files | IndexedDB + server | Workspace state |
| Offline | ❌ | ✅ PWA offline | Partial |
| Install | `curl` / npm | Browser URL → PWA | DMG/EXE |

---

## Key Principle: Reuse, Don't Rewrite

| AIRIS Package | Web IDE Reuse Strategy |
|---------------|----------------------|
| `@sufiyan-sabeel/airis-ai` | **Direct dependency** — provider registry, streaming, model metadata, inference |
| `@sufiyan-sabeel/airis-agent-core` | **Direct dependency** — agent loop, state machine, message handling |
| `@sufiyan-sabeel/airis-cli` (tools) | **Direct dependency** — `edit`, `read`, `write`, `bash`, `grep`, `find` via tool abstraction |
| `@sufiyan-sabeel/airis-cli` (sessions) | **Direct dependency** — serialize/deserialize, compaction, fork/resume |
| `@sufiyan-sabeel/airis-cli` (self-debug) | **Direct dependency** — `SelfDebugBrain`, error analysis |
| `@sufiyan-sabeel/airis-cli` (extensions) | **Direct dependency** — extension loader, lifecycle hooks |
| `@sufiyan-sabeel/airis-tui` (themes) | **JSON theme tokens** via CSS variables — skip terminal rendering |
| `@sufiyan-sabeel/airis-tui` (keybindings) | **Keybinding schema** — reuse definitions, map to browser keys |

---

## Summary

**Build-first**: A TypeScript monorepo with a React frontend (Monaco editor + chat) and Node.js backend wrapping AIRIS-CLI's existing packages. The PWA works on mobile (installable from browser) and desktop (full browser IDE).

**Key advantage**: AIRIS-CLI is already TypeScript. The web IDE reuses all core packages directly — provider system, agent loop, tool system, session management, self-debug, extensions, skills — with zero porting. Only the UI layer changes from terminal TUI to web React components.

**Like Cursor, but**:
- Runs in any browser (no install required on desktop)
- PWA-installable on mobile (works on Android/iOS)
- Reuses AIRIS-CLI's 20+ provider ecosystem
- Same tool permission model, session system, extension API
- Open source, self-hostable, no vendor lock-in
