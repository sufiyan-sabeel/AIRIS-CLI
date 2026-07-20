"use client";

import { motion } from "framer-motion";
import { architectureLayers } from "@/lib/site";
import { cn } from "@/lib/utils";

export function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="relative flex flex-col gap-3">
        {/* connector spine */}
        <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary/40 via-accent/30 to-transparent md:block" />

        {architectureLayers.map((layer, idx) => {
          const Icon = layer.icon;
          return (
            <motion.div
              key={layer.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className={cn(
                "group relative flex items-center gap-4 rounded-xl border border-border bg-card/70 p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-[0_0_30px_-12px_hsl(var(--primary)/0.5)] glass",
                idx % 2 === 0 ? "md:mr-[52%]" : "md:ml-[52%]"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{layer.name}</p>
                <p className="text-xs text-muted-foreground">{layer.detail}</p>
              </div>
              <span className="ml-auto hidden font-mono text-[11px] text-muted-foreground/60 md:block">
                L{idx + 1}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
