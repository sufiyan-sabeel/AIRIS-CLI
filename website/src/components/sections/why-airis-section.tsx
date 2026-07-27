"use client";

import { motion } from "framer-motion";
import { Check, X, Terminal, Smartphone, Shield, Sparkles, GitBranch, Plug, Palette, Globe, Cpu, Cloud, Code2, BookOpen, Workflow, Puzzle, FileCode2 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";

interface ComparisonRow {
  feature: string;
  airis: boolean | string;
  cursor: boolean | string;
  claudeCode: boolean | string;
  geminiCli: boolean | string;
  highlight?: boolean;
}

const rows: ComparisonRow[] = [
  { feature: "Open source", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Local-first architecture", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Android / Termux support", airis: true, cursor: false, claudeCode: false, geminiCli: true, highlight: true },
  { feature: "Multi-provider AI routing", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "20+ AI providers", airis: true, cursor: "4", claudeCode: "2", geminiCli: "1" },
  { feature: "Extension system", airis: true, cursor: true, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Mission contracts", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Visual verification", airis: "Planned", cursor: true, claudeCode: false, geminiCli: true },
  { feature: "Voice support", airis: "Planned", cursor: false, claudeCode: false, geminiCli: true },
  { feature: "Theme system (51 tokens)", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Session save/resume/fork", airis: true, cursor: true, claudeCode: false, geminiCli: false },
  { feature: "Project trust controls", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Ship workflow (plan-implement-verify)", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
  { feature: "Terminal-native", airis: true, cursor: false, claudeCode: true, geminiCli: true },
  { feature: "One-shot prompt mode", airis: true, cursor: true, claudeCode: true, geminiCli: true },
  { feature: "No vendor lock-in", airis: true, cursor: false, claudeCode: false, geminiCli: false, highlight: true },
];

const highlightCards = [
  { icon: Terminal, label: "100% Open Source", value: "MIT", description: "Free forever. Self-host or contribute." },
  { icon: Cloud, label: "AI Provider Support", value: "20+", description: "Anthropic, OpenAI, Google, Groq, and more." },
  { icon: Smartphone, label: "Mobile Ready", value: "Android", description: "Native Termux support with ADB." },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center justify-center">
        <Check className={cn("h-4 w-4", highlight ? "text-emerald-400" : "text-emerald-500/70")} />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center">
        <X className="h-4 w-4 text-muted-foreground/30" />
      </span>
    );
  }
  return (
    <span className={cn(
      "text-xs font-medium",
      value === "Planned" ? "text-amber-400/80" : "text-muted-foreground/60"
    )}>
      {value}
    </span>
  );
}

import { cn } from "@/lib/utils";

export function WhyAirisSection() {
  return (
    <section id="why-airis" className="container py-20">
      <SectionHeader
        eyebrow="Why AIRIS?"
        title="Built different. Built for you."
        description="Here's how AIRIS stacks up against every other AI coding tool. No marketing fluff — just the facts."
      />

      {/* Highlight stat cards */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {highlightCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="relative overflow-hidden rounded-xl border border-border/60 bg-card/50 p-5 glass-reflect"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-semibold text-gradient">{card.value}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{card.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="mt-12 overflow-x-auto rounded-xl border border-border/60">
        <table className="comp-table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-card/60">
              <th className="px-4 py-3.5 font-semibold text-foreground">Feature</th>
              <th className="px-4 py-3.5 font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  AIRIS
                </span>
              </th>
              <th className="px-4 py-3.5 font-medium text-muted-foreground/70">Cursor</th>
              <th className="px-4 py-3.5 font-medium text-muted-foreground/70">Claude Code</th>
              <th className="px-4 py-3.5 font-medium text-muted-foreground/70">Gemini CLI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.feature}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className={cn(
                  "border-b border-border/30 transition-colors hover:bg-muted/20",
                  row.highlight && "bg-primary/[0.02]"
                )}
              >
                <td className="px-4 py-3 font-medium text-foreground/90">
                  <span className="flex items-center gap-2">
                    {row.feature}
                    {row.highlight && (
                      <Sparkles className="h-3 w-3 text-accent shrink-0" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3"><Cell value={row.airis} highlight={row.highlight} /></td>
                <td className="px-4 py-3"><Cell value={row.cursor} /></td>
                <td className="px-4 py-3"><Cell value={row.claudeCode} /></td>
                <td className="px-4 py-3"><Cell value={row.geminiCli} /></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground/50">
        Information current as of July 2026. Features may change — we keep this table honest.
        Planned features noted where applicable.
      </p>
    </section>
  );
}
