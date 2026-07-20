"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CornerDownLeft, TerminalSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LineKind = "input" | "out" | "ok" | "info" | "accent" | "muted";

interface TermLine {
  id: number;
  kind: LineKind;
  text: string;
}

const PROMPT = "airis";

const HELP_LINES: TermLine[] = [
  { id: 0, kind: "muted", text: "AIRIS — Artificial Intelligence Responsive Integrated System" },
  { id: 0, kind: "muted", text: "commands: -p, --provider, --model, --list-models, trust," },
  { id: 0, kind: "muted", text: "          ship, session, doctor, theme, --extension" },
];

function buildResponse(input: string): Omit<TermLine, "id">[] {
  const cmd = input.trim();
  const lower = cmd.toLowerCase();

  if (lower === "help" || lower === "airis --help" || lower === "airis help") {
    return [
      { kind: "out", text: "AIRIS command reference" },
      { kind: "muted", text: "  airis                 launch interactive session" },
      { kind: "muted", text: "  airis -p \"...\"        one-shot prompt" },
      { kind: "muted", text: "  airis --list-models   discover configured models" },
      { kind: "muted", text: "  airis ship start \"\"  run a development workflow" },
      { kind: "muted", text: "  airis doctor          check runtime health" },
    ];
  }

  if (lower.startsWith("airis -p") || lower.startsWith("airis \"") || lower.startsWith("airis @")) {
    return [
      { kind: "info", text: "› Reading context from working directory…" },
      { kind: "out", text: "› Found 47 .ts files across 12 directories" },
      { kind: "out", text: "  src/" },
      { kind: "out", text: "    ├── components/   (Header.tsx, Sidebar.tsx)" },
      { kind: "out", text: "    ├── utils/        (helpers.ts, parser.ts)" },
      { kind: "out", text: "    └── types/index.ts" },
      { kind: "accent", text: "✓ Summary: the entry point is src/components/App.tsx —" },
      { kind: "accent", text: "  routing is declared in the App component, not a router file." },
    ];
  }

  if (lower.includes("--list-models")) {
    return [
      { kind: "info", text: "› Discovered 20+ providers via environment config" },
      { kind: "out", text: "  anthropic/claude-sonnet-4      google/gemini-2.5-pro" },
      { kind: "out", text: "  openai/gpt-4o                  deepseek/deepseek-chat" },
      { kind: "out", text: "  groq/llama-3.3-70b            ollama/llama3 (local)" },
      { kind: "muted", text: "  set one with: airis --provider anthropic --model *sonnet*" },
    ];
  }

  if (lower.startsWith("airis doctor") || lower === "doctor") {
    return [
      { kind: "ok", text: "✓ Node.js 22.19.0 detected" },
      { kind: "ok", text: "✓ Config directory ~/.airis/agent is writable" },
      { kind: "ok", text: "✓ At least one provider credential resolved" },
      { kind: "ok", text: "✓ TUI adaptive layout ready" },
      { kind: "accent", text: "All systems nominal." },
    ];
  }

  if (lower.startsWith("airis ship") || lower.includes("ship start")) {
    return [
      { kind: "info", text: "› Contract: implement feature from request" },
      { kind: "ok", text: "✓ Planning complete (3 steps)" },
      { kind: "info", text: "› Implementing changes…" },
      { kind: "ok", text: "✓ Tests passing" },
      { kind: "accent", text: "✓ Verification passed — proof report ready" },
    ];
  }

  if (lower.startsWith("airis session") || lower.includes("session list")) {
    return [
      { kind: "out", text: "Recent sessions" },
      { kind: "muted", text: "  a91f3c  feat: add auth middleware   2h ago" },
      { kind: "muted", text: "  b20e1d  refactor: parser utils       yesterday" },
      { kind: "muted", text: "  c7d844  docs: install guide         3d ago" },
    ];
  }

  if (lower.startsWith("airis trust") || lower === "trust") {
    return [
      { kind: "ok", text: "✓ Project /home/dev/airis-app is now trusted" },
      { kind: "muted", text: "  AIRIS may read project files and run approved tools." },
    ];
  }

  if (lower.startsWith("airis")) {
    return [
      { kind: "info", text: "› Launching interactive session… (type a message or -p)" },
      { kind: "accent", text: "  How can I help with your code today?" },
    ];
  }

  if (lower === "clear") return [];
  return [
    { kind: "muted", text: `command not found: ${cmd.split(" ")[0]}` },
    { kind: "muted", text: "  try: help · airis -p \"...\" · airis doctor" },
  ];
}

const SUGGESTIONS = [
  'airis -p "summarize this repo"',
  "airis --list-models",
  "airis doctor",
  'airis ship start "add tests"',
];

export function TerminalDemo({ className }: { className?: string }) {
  const [lines, setLines] = React.useState<TermLine[]>([
    { id: Date.now(), kind: "muted", text: "AIRIS interactive demo — type a command or tap a chip below." },
  ]);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const idRef = React.useRef(Date.now());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const nextId = () => ++idRef.current;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const run = React.useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input || busy) return;
      const promptLine: TermLine = { id: nextId(), kind: "input", text: input };
      setLines((l) => [...l, promptLine]);
      setValue("");
      setBusy(true);

      const response = buildResponse(input);

      if (reduced || response.length <= 1) {
        setLines((l) => [...l, ...response.map((r) => ({ ...r, id: nextId() }))]);
        setBusy(false);
        return;
      }

      let i = 0;
      const tick = () => {
        if (i >= response.length) {
          setBusy(false);
          return;
        }
        setLines((l) => [...l, { ...response[i], id: nextId() }]);
        i += 1;
        setTimeout(tick, 220 + Math.random() * 160);
      };
      setTimeout(tick, 260);
    },
    [busy, reduced]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(value);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-[#080b13] shadow-2xl shadow-primary/5",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <TerminalSquare className="h-3.5 w-3.5 text-accent" />
            airis@terminal
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/70">
          <Sparkles className="h-3 w-3 text-primary" />
          live demo
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-[300px] space-y-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed scrollbar-thin sm:h-[340px]"
        role="log"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "whitespace-pre-wrap",
                line.kind === "input" && "text-foreground",
                line.kind === "out" && "text-foreground/80",
                line.kind === "ok" && "text-emerald-400",
                line.kind === "info" && "text-primary",
                line.kind === "accent" && "text-accent",
                line.kind === "muted" && "text-muted-foreground/70"
              )}
            >
              {line.kind === "input" ? (
                <>
                  <span className="select-none text-emerald-400">$ </span>
                  {line.text}
                </>
              ) : (
                line.text
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-primary">
            <span className="caret" />
            <span className="text-muted-foreground/70">thinking…</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => run(s)}
            disabled={busy}
            className="rounded-full border border-border/70 bg-background/50 px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-border/60 px-4 py-3"
      >
        <span className="select-none font-mono text-sm text-emerald-400">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="type a command…"
          aria-label="Terminal input"
          className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Run command"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
