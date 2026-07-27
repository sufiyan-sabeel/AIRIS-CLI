"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Terminal, ChevronRight, CheckCircle2, Cpu, GitBranch, Wrench, Search, Sparkles, FileCode2 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { cn } from "@/lib/utils";

type DemoCommand = {
  id: string;
  label: string;
  icon: React.ElementType;
  lines: { text: string; delay: number; className?: string; indent?: number }[];
};

const demoCommands: DemoCommand[] = [
  {
    id: "explain",
    label: "explain",
    icon: Search,
    lines: [
      { text: "airis -p \"explain this codebase architecture\"", delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "Analyzing repository structure...", delay: 400, className: "text-muted-foreground" },
      { text: "Scanning 142 files across 18 directories...", delay: 600, className: "text-muted-foreground" },
      { text: "", delay: 700 },
      { text: "📁 Architecture Overview", delay: 900, className: "text-emerald-400 font-medium" },
      { text: "├── packages/ai      — AI provider integrations (20+ providers)", delay: 1100, indent: 1 },
      { text: "├── packages/agent   — Core agent loop, state management", delay: 1300, indent: 1 },
      { text: "├── packages/tui     — Adaptive terminal UI", delay: 1500, indent: 1 },
      { text: "├── packages/agent   — Tool execution & missions", delay: 1700, indent: 1 },
      { text: "└── packages/cli     — CLI entry point and config", delay: 1900, indent: 1 },
    ],
  },
  {
    id: "generate",
    label: "generate",
    icon: Sparkles,
    lines: [
      { text: 'airis ship start "add rate limiting middleware"', delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "📋 Creating mission contract...", delay: 400, className: "text-muted-foreground" },
      { text: "✅ Mission #42 — Add rate limiting middleware", delay: 700, className: "text-emerald-400" },
      { text: "", delay: 800 },
      { text: "📄 Implementation plan:", delay: 1000, className: "text-cyan-400 font-medium" },
      { text: "  1. Create middleware/rate-limit.ts", delay: 1200 },
      { text: "  2. Add Redis-backed token bucket", delay: 1400 },
      { text: "  3. Wire into Express router", delay: 1600 },
      { text: "  4. Add config options (window, max)", delay: 1800 },
      { text: "", delay: 1900 },
      { text: "🔧 Implementing step 1/4...", delay: 2100, className: "text-accent" },
      { text: "   Created middleware/rate-limit.ts", delay: 2400, className: "text-emerald-400" },
      { text: "   + TokenBucket class (sliding window)", delay: 2600 },
      { text: "   + Redis adapter interface", delay: 2750 },
      { text: "✅ Step 1 complete", delay: 2900, className: "text-emerald-400" },
    ],
  },
  {
    id: "commit",
    label: "commit",
    icon: GitBranch,
    lines: [
      { text: "airis -p \"write a commit message for staged changes\"", delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "Analyzing git diff...", delay: 400, className: "text-muted-foreground" },
      { text: "Found 8 files changed, 142 insertions, 38 deletions", delay: 600, className: "text-muted-foreground" },
      { text: "", delay: 700 },
      { text: "feat(api): add rate limiting middleware", delay: 900, className: "text-emerald-400 font-medium" },
      { text: "", delay: 1000 },
      { text: "Implement token bucket rate limiting with Redis backend.", delay: 1200 },
      { text: "  - TokenBucket class with configurable window/max", delay: 1400 },
      { text: "  - Redis adapter for distributed rate tracking", delay: 1550 },
      { text: "  - Express middleware integration", delay: 1700 },
      { text: "  - Config options: AIRIS_RATE_LIMIT_WINDOW, AIRIS_RATE_LIMIT_MAX", delay: 1850 },
      { text: "", delay: 1950 },
      { text: "Closes #127", delay: 2100 },
    ],
  },
  {
    id: "doctor",
    label: "doctor",
    icon: Cpu,
    lines: [
      { text: "airis doctor", delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "🔍 Running diagnostics...", delay: 400, className: "text-accent" },
      { text: "", delay: 500 },
      { text: "✅ Node.js         v22.19.0", delay: 700, className: "text-emerald-400" },
      { text: "✅ npm             v11.18.0", delay: 900, className: "text-emerald-400" },
      { text: "✅ Git             v2.45.1", delay: 1100, className: "text-emerald-400" },
      { text: "✅ Terminal        xterm-256color (152 cols x 42 rows)", delay: 1300, className: "text-emerald-400" },
      { text: "✅ Config          ~/.config/airis/config.yml", delay: 1500, className: "text-emerald-400" },
      { text: "✅ Providers       4 configured, 0 expiring", delay: 1700, className: "text-emerald-400" },
      { text: "", delay: 1800 },
      { text: "⚠ Extensions      1 pending update (adb-automation)", delay: 2000, className: "text-amber-400" },
      { text: "", delay: 2100 },
      { text: "System health: EXCELLENT", delay: 2300, className: "text-emerald-400 font-semibold" },
    ],
  },
  {
    id: "analyze",
    label: "analyze",
    icon: FileCode2,
    lines: [
      { text: 'airis -p "find performance bottlenecks in src/api" @src/api', delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "Reading src/api/**/*.ts (24 files)...", delay: 400, className: "text-muted-foreground" },
      { text: "", delay: 550 },
      { text: "🔍 Analysis results:", delay: 700, className: "text-accent font-medium" },
      { text: "", delay: 750 },
      { text: "⚠ Performance concerns found:", delay: 900, className: "text-amber-400" },
      { text: "  1. routes/users.ts:89 — N+1 query in loop (User.find → 142 queries)", delay: 1100 },
      { text: "     Fix: Use eager loading with .includes('posts')", delay: 1250, className: "text-muted-foreground" },
      { text: "  2. middleware/auth.ts:34 — Synchronous crypto on hot path", delay: 1450 },
      { text: "     Fix: Cache JWT public key with 5min TTL", delay: 1600, className: "text-muted-foreground" },
      { text: "  3. utils/validator.ts:12 — Repeated schema compilation", delay: 1800 },
      { text: "     Fix: Memoize compiled schemas", delay: 1950, className: "text-muted-foreground" },
      { text: "", delay: 2050 },
      { text: "✅ Report saved to .airis/performance-report.md", delay: 2250, className: "text-emerald-400" },
    ],
  },
  {
    id: "update",
    label: "update",
    icon: Wrench,
    lines: [
      { text: "airis doctor --fix", delay: 0, className: "text-accent" },
      { text: "", delay: 200 },
      { text: "🔍 Running diagnostics...", delay: 400, className: "text-accent" },
      { text: "✅ All dependencies up to date", delay: 700, className: "text-emerald-400" },
      { text: "⚠ Extension adb-automation v0.2.1 → v0.3.0", delay: 900, className: "text-amber-400" },
      { text: "", delay: 1000 },
      { text: "Updating adb-automation...", delay: 1200, className: "text-accent" },
      { text: "  ✓ Downloaded v0.3.0", delay: 1500, className: "text-emerald-400" },
      { text: "  ✓ Verified integrity", delay: 1700, className: "text-emerald-400" },
      { text: "  ✓ Installed", delay: 1900, className: "text-emerald-400" },
      { text: "", delay: 2000 },
      { text: "✅ 1 extension updated. Restart AIRIS to apply.", delay: 2200, className: "text-emerald-400" },
    ],
  },
];

function Line({ line, visible }: { line: DemoCommand["lines"][0]; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "whitespace-pre font-mono text-xs leading-relaxed sm:text-sm",
            line.className || "text-foreground/80",
            line.indent && `ml-${line.indent * 3}`
          )}
          style={line.indent ? { paddingLeft: `${line.indent * 12}px` } : undefined}
        >
          {line.text || "\u00A0"}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CliPlaygroundSection() {
  const [activeCommand, setActiveCommand] = useState(demoCommands[0]);
  const [visibleLines, setVisibleLines] = useState<Set<number>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runCommand = useCallback((cmd: DemoCommand) => {
    clearTimers();
    setActiveCommand(cmd);
    setVisibleLines(new Set());
    setIsRunning(true);

    const timers: ReturnType<typeof setTimeout>[] = [];
    cmd.lines.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisibleLines((prev) => new Set(prev).add(i));
        if (i === cmd.lines.length - 1) {
          setIsRunning(false);
        }
      }, line.delay);
      timers.push(t);
    });
    timersRef.current = timers;
  }, [clearTimers]);

  const resetCommand = useCallback(() => {
    clearTimers();
    setVisibleLines(new Set());
    setIsRunning(false);
  }, [clearTimers]);

  useEffect(() => {
    runCommand(demoCommands[0]);
    return clearTimers;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="cli-playground" className="container py-20">
      <SectionHeader
        eyebrow="CLI Playground"
        title="See AIRIS in action"
        description="Watch real CLI workflows play out in your browser. Each demo runs a complete session from prompt to result."
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Command selector */}
        <div className="space-y-1">
          {demoCommands.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => runCommand(cmd)}
              disabled={isRunning}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all",
                activeCommand.id === cmd.id
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <cmd.icon className="h-4 w-4 shrink-0" />
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>

        {/* Terminal output */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <span className="ml-3 font-mono text-[11px] text-muted-foreground/60">
                airis@{activeCommand.label} — 80×24
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => runCommand(activeCommand)}
                disabled={isRunning}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Play"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={resetCommand}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-[320px] px-4 py-3 font-mono text-sm leading-relaxed">
            {/* Prompt line */}
            <div className="flex items-start gap-2 mb-2">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-accent">{activeCommand.lines[0].text}</span>
            </div>
            {/* Output lines */}
            <div className="space-y-0.5 pl-6">
              {activeCommand.lines.slice(1).map((line, i) => (
                <Line key={i} line={line} visible={visibleLines.has(i + 1)} />
              ))}
              {isRunning && (
                <span className="inline-block h-4 w-2 animate-pulse bg-accent/70" />
              )}
            </div>
          </div>
          {activeCommand.lines.length - 1 === visibleLines.size && !isRunning && (
            <div className="flex items-center gap-2 border-t border-border/40 bg-emerald-500/5 px-4 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] text-emerald-400">
                Completed — {activeCommand.id === "doctor" ? "System ready" : "Exit code: 0"}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
