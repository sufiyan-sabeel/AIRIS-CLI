"use client";

import { motion } from "framer-motion";
import { repo, terminalLines } from "@/data/site";

export function TerminalDemo() {
  return (
    <div className="terminal-glow shine-card w-full max-w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-blue-950/10 dark:bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-1 font-mono text-xs text-blue-200">airis</span>
      </div>
      <div className="space-y-4 p-5 font-mono text-sm leading-7 text-zinc-200 sm:p-6">
        {terminalLines.map((line, index) => {
          const delay = 0.25 + index * 0.45;

          return (
            <motion.div key={line} className="whitespace-pre-wrap" aria-label={line} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.18 }}>
              <span className="text-blue-300" aria-hidden>{line.slice(0, 1)}</span>
              <span aria-hidden>
                {Array.from(line.slice(1)).map((letter, letterIndex) => (
                  <motion.span
                    key={`${line}-${letterIndex}`}
                    className="inline-block"
                    initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: delay + 0.06 + letterIndex * 0.018, duration: 0.18, ease: "easeOut" }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
              {index === terminalLines.length - 1 ? <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-caret bg-blue-300" aria-hidden /> : null}
            </motion.div>
          );
        })}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 0.35 }} className="rounded-2xl border border-blue-300/20 bg-blue-300/[0.06] p-4 text-zinc-300">
          AIRIS v{repo.version} · 30+ Providers · 18 Themes · 7 Tools · Brand: {repo.organization}
        </motion.div>
      </div>
    </div>
  );
}
