"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Copy, Smartphone, Monitor, Terminal } from "lucide-react";

type Platform = "linux" | "macos" | "windows" | "termux";

const installScripts: Record<Platform, { label: string; icon: typeof Terminal; code: string; badge: string }> = {
  linux: {
    label: "Linux",
    icon: Terminal,
    badge: "Recommended",
    code: "curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash",
  },
  macos: {
    label: "macOS",
    icon: Monitor,
    badge: "Homebrew",
    code: "brew install node\ngit clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts\nnpm run build\nnpm link",
  },
  windows: {
    label: "Windows",
    icon: Monitor,
    badge: "PowerShell",
    code: "git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install --ignore-scripts\nnpm run build\nnpm link",
  },
  termux: {
    label: "Termux",
    icon: Smartphone,
    badge: "Android",
    code: "pkg update && pkg upgrade\npkg install nodejs git\nnpm install -g @sufiyan-sabeel/airis-cli\nairis --version",
  },
};

const typingLines: Record<Platform, string[]> = {
  linux: [
    "$ curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash",
    "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current",
    "                                 Dload  Upload   Total   Spent    Left  Speed",
    "100  2345  100  2345    0     0   1234      0 --:--:--  0:00:01 --:--:--  1234",
    "",
    "✓ AIRIS CLI installed successfully",
    "✓ Added to PATH: /usr/local/bin/airis",
    "",
    "$ airis --version",
    "airis 0.79.9",
    "",
    "$ airis --help",
    "AIRIS - AI-Powered Command-Line Assistant",
    "Usage: airis [options] [command]",
    "",
    "  -p, --prompt     One-shot prompt mode",
    "  --provider       AI provider selection",
    "  --model          Model selection",
    "  --list-models    List available models",
    "",
    "Run 'airis' to start interactive mode.",
    "",
    "$ airis",
    "╭──────────────────────────────────────────────╮",
    "│  Welcome to AIRIS interactive mode           │",
    "│  Type your request or /help for commands     │",
    "╰──────────────────────────────────────────────╯",
    "",
    "You > ",
  ],
  macos: [
    "$ brew install node",
    "==> Downloading https://brew.sh...",
    "==> Installing node",
    "🍺  /usr/local/Cellar/node/22.19.0: 2456 files",
    "",
    "$ git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git",
    "Cloning into 'AIRIS-CLI'...",
    "Receiving objects: 100% (45231/45231), 12.4 MiB",
    "",
    "$ cd AIRIS-CLI && npm install && npm run build",
    "+ @sufiyan-sabeel/airis-cli@0.79.9",
    "✓ Build complete",
    "",
    "$ airis --version",
    "airis 0.79.9",
  ],
  windows: [
    "> git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git",
    "Cloning into 'AIRIS-CLI'...",
    "Receiving objects: 100% (45231/45231), 12.4 MiB",
    "",
    "> cd AIRIS-CLI",
    "> npm install --ignore-scripts",
    "+ @sufiyan-sabeel/airis-cli@0.79.9",
    "",
    "> npm run build",
    "✓ Build complete",
    "",
    "> airis --version",
    "airis 0.79.9",
  ],
  termux: [
    "$ pkg update",
    "Hit:1 https://packages.termux.dev/apt/termux-main stable InRelease",
    "Reading package lists... Done",
    "",
    "$ pkg install nodejs git",
    "Installing nodejs (22.19.0) ...",
    "Installing git (2.45.0) ...",
    "✓ Installation complete",
    "",
    "$ npm install -g @sufiyan-sabeel/airis-cli",
    "+ @sufiyan-sabeel/airis-cli@0.79.9",
    "",
    "$ airis --version",
    "airis 0.79.9",
    "",
    "$ airis",
    "╭──────────────────────────────────────────────╮",
    "│  Welcome to AIRIS on Android 📱              │",
    "│  Type your request or /help for commands     │",
    "╰──────────────────────────────────────────────╯",
    "",
    "You > ",
  ],
};

export function InteractiveTerminal() {
  const [platform, setPlatform] = useState<Platform>("linux");
  const [visibleLines, setVisibleLines] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const currentScript = installScripts[platform];
  const PlatformIcon = currentScript.icon;
  const lines = typingLines[platform];

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentScript.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = currentScript.code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentScript.code]);

  const resetAnimation = useCallback(() => {
    setVisibleLines(0);
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    if (!isPlaying || prefersReduced) return;
    if (visibleLines >= lines.length) {
      setIsPlaying(false);
      return;
    }
    const delay = lines[visibleLines] === "" ? 150 : 30 + Math.random() * 40;
    const timer = setTimeout(() => {
      setVisibleLines((p) => p + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [visibleLines, isPlaying, lines, prefersReduced]);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLines]);

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
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 items-center gap-1.5 rounded-md border border-emerald-400/10 bg-emerald-500/5 px-2 font-mono text-[10px] text-emerald-300/80 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              airis@terminal
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyCode}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              aria-label="Copy install command"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {!isPlaying && (
              <button
                type="button"
                onClick={resetAnimation}
                className="flex h-6 items-center gap-1 rounded-md border border-white/5 px-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 sm:text-xs"
                aria-label="Replay"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                Replay
              </button>
            )}
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(Object.entries(installScripts) as [Platform, typeof currentScript][]).map(([key, script]) => {
            const Icon = script.icon;
            const isActive = platform === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setPlatform(key); setVisibleLines(0); setIsPlaying(true); }}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-medium transition-colors sm:px-4 sm:text-xs ${
                  isActive
                    ? "border-blue-500 text-blue-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{script.label}</span>
                <span className="sm:hidden">{script.label.slice(0, 4)}</span>
              </button>
            );
          })}
        </div>

        {/* Terminal Content */}
        <div
          ref={terminalRef}
          className="relative h-[320px] overflow-y-auto p-4 font-mono text-xs leading-6 text-zinc-200 sm:h-[380px] sm:p-6 sm:text-sm sm:leading-7"
          aria-label={`Interactive terminal demo for ${platform}`}
          role="log"
        >
          {prefersReduced ? (
            <div className="space-y-0.5">
              {lines.map((line, i) => (
                <div key={i}>
                  {line ? (
                    <span className={line.startsWith("$") ? "text-zinc-100" : line.startsWith("✓") ? "text-emerald-300" : "text-zinc-400"}>
                      {line}
                    </span>
                  ) : <br />}
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={platform}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {lines.slice(0, visibleLines).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {line ? (
                      <span className={
                        line.startsWith("$") || line.startsWith(">")
                          ? "text-zinc-100"
                          : line.startsWith("✓")
                            ? "text-emerald-300"
                            : line.startsWith("╭") || line.startsWith("│") || line.startsWith("╰")
                              ? "text-blue-300/60"
                              : "text-zinc-400"
                      }>
                        {line.startsWith("$") || line.startsWith(">") ? (
                          <><span className="mr-2 select-none text-emerald-400 font-medium">{line[0]}</span>{line.slice(1).trimStart()}</>
                        ) : (
                          line
                        )}
                      </span>
                    ) : <br />}
                  </motion.div>
                ))}
                {visibleLines < lines.length && (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-emerald-400 font-medium">$</span>
                    <span className="inline-block h-4 w-[2px] rounded-sm bg-zinc-300 animate-caret" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Quick copy bar */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 sm:px-5">
          <code className="truncate text-[11px] text-zinc-500 sm:text-xs">
            {currentScript.code}
          </code>
          <button
            type="button"
            onClick={copyCode}
            className="ml-2 shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 sm:text-xs"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
