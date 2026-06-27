"use client";

import { motion } from "framer-motion";
import { terminalLines } from "@/data/site";

export function TerminalDemo() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-zinc-950 shadow-2xl shadow-blue-950/10 dark:bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <span className="font-mono text-xs text-zinc-500">airis</span>
      </div>
      <div className="space-y-4 p-5 font-mono text-sm leading-7 text-zinc-200 sm:p-6">
        {terminalLines.map((line, index) => (
          <motion.div
            key={line}
            className="whitespace-pre-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 + index * 0.45, duration: 0.2 }}
          >
            <span className="text-blue-300">{line.slice(0, 1)}</span>{line.slice(1)}
            {index === terminalLines.length - 1 ? <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-caret bg-blue-300" aria-hidden /> : null}
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6, duration: 0.35 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-zinc-400">
          AIRIS v0.79.3 · Artificial Intelligence Responsive Integrated System · Brand: KageOS
        </motion.div>
      </div>
    </div>
  );
}
