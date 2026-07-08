"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { repo } from "@/data/site";

const lines = [
  { text: "npm install -g @sufiyan-sabeel/airis-cli", type: "input" as const, speed: 20 },
  { text: "+ airis-cli@0.79.8", type: "output" as const, speed: 0, delay: 600 },
  { text: "", type: "blank" as const, speed: 0, delay: 200 },
  { text: "airis --provider gemini -p \"List all TypeScript files in src/\"", type: "input" as const, speed: 18 },
  { text: "", type: "blank" as const, speed: 0, delay: 300 },
  { text: "> Analyzing project structure...", type: "output" as const, speed: 30, delay: 200 },
  { text: "> Found 47 .ts files across 12 directories", type: "output" as const, speed: 0, delay: 400 },
  { text: "", type: "blank" as const, speed: 0, delay: 200 },
  { text: "src/", type: "output" as const, speed: 0, delay: 100 },
  { text: "  ├── components/", type: "output" as const, speed: 0, delay: 80 },
  { text: "  │   ├── App.tsx", type: "output" as const, speed: 0, delay: 60 },
  { text: "  │   ├── Header.tsx", type: "output" as const, speed: 0, delay: 60 },
  { text: "  │   └── Sidebar.tsx", type: "output" as const, speed: 0, delay: 60 },
  { text: "  ├── utils/", type: "output" as const, speed: 0, delay: 80 },
  { text: "  │   ├── helpers.ts", type: "output" as const, speed: 0, delay: 60 },
  { text: "  │   └── parser.ts", type: "output" as const, speed: 0, delay: 60 },
  { text: "  └── types/", type: "output" as const, speed: 0, delay: 80 },
  { text: "      └── index.ts", type: "output" as const, speed: 0, delay: 60 },
  { text: "", type: "blank" as const, speed: 0, delay: 400 },
  { text: "airis ship start \"Add authentication middleware\"", type: "input" as const, speed: 16 },
  { text: "", type: "blank" as const, speed: 0, delay: 300 },
  { text: "  📋 Contract: Add JWT-based auth middleware", type: "output" as const, speed: 25, delay: 200 },
  { text: "  ✅ Planning complete (3 steps)", type: "output" as const, speed: 0, delay: 500 },
  { text: "  🔧 Implementing...", type: "output" as const, speed: 0, delay: 300 },
  { text: "  📊 Verification passed", type: "output" as const, speed: 0, delay: 500 },
];

function formatLine(text: string) {
  // Highlight file paths, commands, and special tokens
  return text.split(/(`[^`]+`|──|├──|└──|\b\w+\.\w+\b)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <span key={i} className="text-cyan-300">{part.slice(1, -1)}</span>;
    }
    if (/^\w+\.\w+$/.test(part)) {
      return <span key={i} className="text-blue-300/80">{part}</span>;
    }
    if (part === "──" || part.startsWith("├") || part.startsWith("└")) {
      return <span key={i} className="text-zinc-600">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function TypewriterLine({ text, type, speed = 20, onDone }: {
  text: string;
  type: "input" | "output" | "blank";
  speed: number;
  onDone: () => void;
}) {
  const [displayed, setDisplayed] = useState(type === "blank" ? "" : "");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (type === "blank") {
      setDone(true);
      onDone();
      return;
    }

    let i = 0;
    const chars = text.split("");
    const interval = setInterval(() => {
      if (i < chars.length) {
        setDisplayed(chars.slice(0, i + 1).join(""));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onDone();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, type, speed, onDone]);

  if (type === "blank") {
    return <div className="h-3" />;
  }

  return (
    <div className={`whitespace-pre-wrap font-mono text-xs leading-6 sm:text-sm sm:leading-7 ${
      type === "input" ? "text-zinc-100" : "text-zinc-400"
    }`}>
      {type === "input" && (
        <span className="mr-2 select-none text-emerald-400 font-medium">$</span>
      )}
      {formatLine(displayed)}
      {!done && type === "input" && (
        <span className="ml-0.5 inline-block h-4 w-[2px] bg-zinc-300 align-middle animate-caret" />
      )}
    </div>
  );
}

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [started, setStarted] = useState(false);

  const advanceLine = useCallback(() => {
    setVisibleLines((p) => Math.min(p + 1, lines.length));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="terminal-container">
      <div className="terminal-glow rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl shadow-blue-950/5 dark:bg-[#0a0a0a] sm:rounded-3xl">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 sm:h-3 sm:w-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 sm:h-3 sm:w-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 sm:h-3 sm:w-3" />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden h-5 items-center gap-1.5 rounded-md border border-blue-400/10 bg-blue-500/5 px-2 font-mono text-[10px] text-blue-300/80 sm:inline-flex sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              airis@terminal
            </span>
          </div>
          <div className="text-[10px] text-zinc-600 sm:text-xs">~</div>
        </div>

        {/* Terminal Content */}
        <div
          className="relative min-h-[320px] p-4 font-mono text-xs leading-6 text-zinc-200 sm:min-h-[380px] sm:p-6 sm:text-sm sm:leading-7"
          aria-label="Interactive terminal demo showing AIRIS CLI commands and output"
          role="log"
        >
          <AnimatePresence mode="popLayout">
            {started && (
              <motion.div
                key="terminal-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-0.5"
              >
                {lines.slice(0, visibleLines).map((line, i) => {
                  if (i === visibleLines - 1 && line.type !== "blank") {
                    return (
                      <TypewriterLine
                        key={`${i}-${line.text.slice(0, 10)}`}
                        {...line}
                        onDone={i < lines.length - 1 ? () => {
                          const nextLine = lines[i + 1];
                          const delay = nextLine?.delay ?? 100;
                          setTimeout(advanceLine, delay);
                        } : () => {}}
                      />
                    );
                  }
                  if (line.type === "blank") {
                    return <div key={i} className="h-3" />;
                  }
                  return (
                    <div key={i} className={`whitespace-pre-wrap font-mono text-xs leading-6 sm:text-sm sm:leading-7 ${
                      line.type === "input" ? "text-zinc-100" : "text-zinc-400"
                    }`}>
                      {line.type === "input" && (
                        <span className="mr-2 select-none text-emerald-400 font-medium">$</span>
                      )}
                      {formatLine(line.text)}
                    </div>
                  );
                })}

                {visibleLines < lines.length && (
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-sm text-zinc-200">
                    <span className="text-emerald-400 font-medium">$</span>
                    <span className="inline-block h-4 w-[2px] rounded-sm bg-zinc-300 animate-caret" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle bottom gradient fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>
      </div>
    </div>
  );
}
