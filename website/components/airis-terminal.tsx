"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Copy, Check, RefreshCw, Terminal, Brain, Cpu, Search, Wrench, Shield, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Command Definitions ──

interface CommandDef {
  command: string;
  icon: typeof Terminal;
  description: string;
  output: string[];
  typingSpeed?: number;
  category: string;
}

const commands: CommandDef[] = [
  {
    command: "airis doctor",
    icon: Shield,
    description: "Check runtime health",
    category: "System",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Doctor — System Diagnostics        │",
      "╰───────────────────────────────────────────╯",
      "",
      "  ✓ Node.js          v22.19.0",
      "  ✓ npm              10.8.1",
      "  ✓ Git              2.45.0",
      "  ✓ Python           3.12.2 (not required)",
      "  ✓ Config dir       ~/.airis/agent",
      "  ✓ Cache dir        ~/.airis/cache",
      "  ✓ Logs dir         ~/.airis/logs",
      "",
      "  ✓ API Keys:        3 configured (gemini, openai, anthropic)",
      "  ✓ Extensions:      2 loaded",
      "  ✓ Skills:          5 installed",
      "  ✓ Themes:          12 available",
      "",
      "  ✓ Memory:          256 MB allocated (42% used)",
      "  ✓ Sessions:        3 active",
      "  ✓ Uptime:          2h 34m",
      "",
      "  ✗ Update available: v0.79.9 → v0.79.10",
      "    Run 'airis update' to upgrade.",
      "",
      "  All systems operational.",
    ],
  },
  {
    command: "airis diagnose",
    icon: Search,
    description: "Diagnose configuration",
    category: "System",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Diagnostic Scan                    │",
      "╰───────────────────────────────────────────╯",
      "",
      "  Provider Connectivity:",
      "    ✓ Gemini          145ms  (default)",
      "    ✓ Anthropic       230ms",
      "    ✓ OpenAI          180ms",
      "    ✗ DeepSeek        890ms  (high latency)",
      "    ✓ Ollama (local)   45ms",
      "",
      "  File System:",
      "    ✓ Read access     ~/projects",
      "    ✓ Write access    ~/projects",
      "    ✓ Temp dir        /tmp/airis-*",
      "",
      "  Environment:",
      "    ✓ Shell           /bin/bash",
      "    ✓ TERM            xterm-256color",
      "    ✓ EDITOR          code --wait",
      "    ✓ LANG            en_US.UTF-8",
      "",
      "  Potential Issues:",
      "    ⚠ DeepSeek latency >500ms — consider switching provider",
      "    ⚠ 2 unused API keys found in config",
      "    ℹ 3 sessions have not been used in 7+ days",
    ],
  },
  {
    command: "airis memory",
    icon: Brain,
    description: "Show memory status",
    category: "System",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Memory System                      │",
      "╰───────────────────────────────────────────╯",
      "",
      "  Episodic Memory:",
      "    • Last session:   15 min ago (project-frontend)",
      "    • Total sessions: 47",
      "    • Active context: 3 threads",
      "",
      "  Semantic Memory:",
      "    • Project patterns: 12 learned",
      "    • Code conventions: 8 captured",
      "    • API preferences:  15 remembered",
      "",
      "  Procedural Memory:",
      "    • Workflow templates: 5",
      "    • Custom commands:    3",
      "    • Tool preferences:   7",
      "",
      "  Cache:",
      "    • Memory:   2.4 GB / 4 GB",
      "    • Disk:     8.1 GB / 32 GB",
      "    • Hit rate: 94.2%",
      "",
      "  Memory health: ✓ Optimal",
    ],
  },
  {
    command: "airis tools list",
    icon: Wrench,
    description: "List companion tools",
    category: "Tools",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Companion Tools                    │",
      "╰───────────────────────────────────────────╯",
      "",
      "  Built-in Tools:",
      "    ✓ read          Read file contents",
      "    ✓ write         Write file contents",
      "    ✓ edit          Edit files with precision",
      "    ✓ bash          Execute shell commands",
      "    ✓ grep          Search file contents",
      "    ✓ find          Find files by pattern",
      "    ✓ ls            List directory contents",
      "    ✓ todo          Manage todo lists",
      "",
      "  Detected CLIs:",
      "    ✓ git           v2.45.0",
      "    ✓ node          v22.19.0",
      "    ✓ npm           v10.8.1",
      "    ✓ npx           v10.8.1",
      "    ✓ typescript    v5.8.3",
      "    ✓ eslint        v9.25.1",
      "    ✓ prettier      v3.4.0",
      "",
      "  Extensions:",
      "    ✓ insforge      InsForge backend integration",
      "    ✓ termux-api    Termux Android API bindings",
      "    - litert        LiteRT ML inference (not loaded)",
      "",
      "  15 tools available",
    ],
  },
  {
    command: "airis learn",
    icon: BookOpen,
    description: "Learn from project",
    category: "AI",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Project Learning                   │",
      "╰───────────────────────────────────────────╯",
      "",
      "  Analyzing project structure...",
      "  ✓ Detected: Next.js + TypeScript project",
      "  ✓ Package manager: npm",
      "  ✓ Testing: vitest",
      "  ✓ Linting: eslint",
      "",
      "  Learning project conventions:",
      "  ✓ Import style: ES modules with path aliases",
      "  ✓ Component pattern: React FC with hooks",
      "  ✓ Styling: Tailwind CSS v4",
      "  ✓ Testing pattern: describe/it blocks",
      "",
      "  Storing in semantic memory...",
      "  ✓ 12 patterns learned",
      "  ✓ 8 conventions captured",
      "  ✓ Ready for context-aware assistance",
      "",
      "  Run 'airis' to start working with learned context.",
    ],
  },
  {
    command: "airis install",
    icon: Cpu,
    description: "Install extension",
    category: "Tools",
    output: [
      "╭───────────────────────────────────────────╮",
      "│  AIRIS Extension Installer                │",
      "╰───────────────────────────────────────────╯",
      "",
      "  Installing @airis/extension-insforge...",
      "",
      "  ✓ Resolved source: npm:@airis/extension-insforge",
      "  ✓ Downloaded: 234 kB",
      "  ✓ Verified integrity: sha256-abc123...",
      "  ✓ Installed to: ~/.airis/extensions/insforge",
      "",
      "  Dependencies:",
      "  ✓ @insforge/sdk@latest",
      "  ✓ zod@3.23.8",
      "",
      "  Available commands:",
      "    airis insforge db:list",
      "    airis insforge auth:status",
      "    airis insforge storage:upload",
      "",
      "  ✓ Extension ready. Run 'airis help' for details.",
    ],
  },
];

// ── Syntax highlighting ──

function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = line;

  // Split by special patterns
  const pattern = /(`[^`]+`)|(\b\w+\.\w+\b)|(\b\d+\.?\d*\s*(ms|GB|kB|MB|%)\b)|(✓|✗|⚠|•|ℹ)|(\b(v\d+\.\d+\.\d+)\b)|(@[\w/-]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Inline code
      parts.push(<span key={match.index} className="text-cyan-300">{match[1].slice(1, -1)}</span>);
    } else if (match[3]) {
      // Numbers with units
      parts.push(<span key={match.index} className="text-amber-300">{match[0]}</span>);
    } else if (match[4]) {
      // Status symbols
      const char = match[0];
      if (char === "✓") parts.push(<span key={match.index} className="text-emerald-400">{char}</span>);
      else if (char === "✗") parts.push(<span key={match.index} className="text-red-400">{char}</span>);
      else if (char === "⚠") parts.push(<span key={match.index} className="text-amber-400">{char}</span>);
      else if (char === "ℹ") parts.push(<span key={match.index} className="text-blue-400">{char}</span>);
      else if (char === "•") parts.push(<span key={match.index} className="text-zinc-500">{char}</span>);
      else parts.push(char);
    } else if (match[5]) {
      // Version numbers
      parts.push(<span key={match.index} className="text-blue-300">{match[0]}</span>);
    } else if (match[7]) {
      // @package refs
      parts.push(<span key={match.index} className="text-violet-300">{match[0]}</span>);
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [line];
}

// ── Terminal Output ──

function CommandOutput({
  lines,
  speed = 8,
  onDone,
  isActive,
}: {
  lines: string[];
  speed?: number;
  onDone: () => void;
  isActive: boolean;
}) {
  const [visible, setVisible] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsComplete(true);
      setVisible(lines.length);
      onDone();
      return;
    }

    setVisible(0);
    setIsComplete(false);

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (i >= lines.length) {
        setIsComplete(true);
        onDone();
        return;
      }
      const line = lines[i];
      const delay = line === "" ? 60 : speed + Math.random() * speed;
      timer = setTimeout(() => {
        i++;
        setVisible(i);
        tick();
      }, delay);
    }

    tick();
    return () => clearTimeout(timer);
  }, [lines, speed, isActive, onDone]);

  return (
    <div className="space-y-0.5">
      {lines.slice(0, visible).map((line, i) => (
        <div key={i}>
          {line === "" ? (
            <div className="h-2" />
          ) : line.startsWith("╭") || line.startsWith("╰") ? (
            <span className="text-blue-400/40">{line}</span>
          ) : line.startsWith("│") ? (
            <span className="text-zinc-300">{highlightLine(line)}</span>
          ) : line.startsWith("$") || line.startsWith(">") ? (
            <span>
              <span className="mr-2 text-emerald-400 font-medium select-none">{line[0]}</span>
              {highlightLine(line.slice(1).trimStart())}
            </span>
          ) : (
            <span className="text-zinc-300">{highlightLine(line)}</span>
          )}
        </div>
      ))}
      {isActive && !isComplete && (
        <span className="inline-block h-4 w-[2px] bg-zinc-300 animate-caret align-middle" />
      )}
    </div>
  );
}

// ── Main Component ──

export function AirisTerminal() {
  const [selectedCommand, setSelectedCommand] = useState<string>("airis doctor");
  const [isRunning, setIsRunning] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const currentCommand = useMemo(
    () => commands.find((c) => c.command === selectedCommand) ?? commands[0],
    [selectedCommand]
  );

  const copyCommand = useCallback(() => {
    const text = currentCommand.command;
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentCommand.command]);

  const replay = useCallback(() => {
    setIsRunning(false);
    requestAnimationFrame(() => setIsRunning(true));
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentCommand, isRunning]);

  const Icon = currentCommand.icon;

  return (
    <div className="terminal-container w-full">
      <div className="terminal-glow rounded-2xl border border-white/[0.06] bg-zinc-950 shadow-2xl shadow-blue-950/10 dark:bg-[#0a0a0a] sm:rounded-3xl">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 sm:h-3 sm:w-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 sm:h-3 sm:w-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 sm:h-3 sm:w-3" />
          </div>
          <span className="inline-flex h-5 items-center gap-1.5 rounded-md border border-emerald-400/10 bg-emerald-500/5 px-2 font-mono text-[10px] text-emerald-300/80 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            airis@terminal
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyCommand}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              aria-label="Copy command"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={replay}
              className="flex h-6 items-center gap-1 rounded-md border border-white/5 px-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 sm:text-xs"
              aria-label="Replay"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="max-sm:hidden">Replay</span>
            </button>
          </div>
        </div>

        {/* Command Selector */}
        <div className="flex flex-wrap border-b border-white/[0.06]">
          {commands.map((cmd) => {
            const isActive = selectedCommand === cmd.command;
            const CmdIcon = cmd.icon;
            return (
              <button
                key={cmd.command}
                type="button"
                onClick={() => { setSelectedCommand(cmd.command); setIsRunning(true); }}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                  isActive
                    ? "border-blue-500 text-blue-300 bg-blue-500/5"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                )}
                title={cmd.description}
              >
                <CmdIcon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{cmd.command.replace("airis ", "")}</span>
                <span className="sm:hidden">{cmd.command.replace("airis ", "").slice(0, 6)}</span>
              </button>
            );
          })}
        </div>

        {/* Terminal Content */}
        <div
          ref={terminalRef}
          className="relative h-[340px] overflow-y-auto p-4 font-mono text-xs leading-6 text-zinc-200 sm:h-[400px] sm:p-6 sm:text-sm sm:leading-7"
          aria-label={`AIRIS terminal showing output of ${currentCommand.command}`}
          role="log"
        >
          {prefersReduced ? (
            <div className="space-y-0.5">
              {currentCommand.output.map((line, i) => (
                <div key={i}>
                  {line === "" ? <div className="h-2" /> : (
                    <span className={
                      line.startsWith("╭") || line.startsWith("╰") ? "text-blue-400/40" :
                      line.startsWith("│") ? "text-zinc-300" :
                      "text-zinc-300"
                    }>{line}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCommand.command}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isRunning ? (
                  <CommandOutput
                    lines={currentCommand.output}
                    speed={currentCommand.typingSpeed ?? 8}
                    onDone={() => {}}
                    isActive={true}
                  />
                ) : (
                  <CommandOutput
                    lines={currentCommand.output}
                    speed={1}
                    onDone={() => setIsRunning(false)}
                    isActive={false}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Bottom fade */}
          <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>

        {/* Quick action bar */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-blue-400" />
            <code className="text-[11px] text-zinc-400 sm:text-xs">{currentCommand.command}</code>
            <span className="hidden text-[10px] text-zinc-600 sm:inline">{currentCommand.description}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{currentCommand.category}</span>
            <button
              type="button"
              onClick={copyCommand}
              className="rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 sm:text-xs"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
