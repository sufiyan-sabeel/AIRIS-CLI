import Link from "next/link";
import { ArrowRight, RefreshCw, Sparkles, Bug, Package, Clock } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";

const changelog = [
  {
    version: "0.79.8",
    date: "2026-07-13",
    type: "release",
    title: "Web Platform Launch",
    changes: [
      { type: "added", description: "Multi-page marketing website with 14+ landing pages" },
      { type: "added", description: "AI Operating System Dashboard with workspace management" },
      { type: "added", description: "AIRIS Web IDE with Monaco editor, chat, file tree, and terminal" },
      { type: "added", description: "PWA support for mobile installation" },
      { type: "added", description: "Self-update system with changelog tracking" },
      { type: "added", description: "Documentation portal with quick start, CLI ref, provider guides" },
      { type: "changed", description: "Upgraded marketing design to Apple-level premium aesthetic" },
      { type: "changed", description: "Expanded AI provider support to 20+ providers" },
    ],
  },
  {
    version: "0.79.0",
    date: "2026-07-01",
    type: "release",
    title: "Agent System & Workflow Automation",
    changes: [
      { type: "added", description: "Multi-agent orchestration system" },
      { type: "added", description: "Visual workflow builder (alpha)" },
      { type: "added", description: "Agent memory persistence" },
    ],
  },
  {
    version: "0.78.0",
    date: "2026-06-15",
    type: "release",
    title: "Mobile & Android Enhancements",
    changes: [
      { type: "added", description: "ADB device control integration" },
      { type: "added", description: "Termux API support" },
      { type: "fixed", description: "Termux file system path resolution" },
    ],
  },
  {
    version: "0.77.0",
    date: "2026-06-01",
    type: "release",
    title: "Provider Ecosystem Expansion",
    changes: [
      { type: "added", description: "DeepSeek, xAI Grok, Cerebras, NVIDIA NIM support" },
      { type: "changed", description: "Optimized provider routing for cost efficiency" },
    ],
  },
];

const typeColors: Record<string, string> = {
  added: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  changed: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  fixed: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  removed: "bg-red-400/10 text-red-300 border-red-400/20",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <RefreshCw className="h-3 w-3 text-blue-400" />
              <span>Changelog</span>
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              What&apos;s new in{" "}
              <span className="gradient-text">AIRIS</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Stay up to date with the latest features, improvements, and fixes. AIRIS is constantly evolving.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Current version: <span className="font-medium text-foreground">v0.79.8</span>
              <span className="mx-2">·</span>
              Latest release: <span className="font-medium text-emerald-400">Web Platform Launch</span>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              {changelog.map((entry, idx) => (
                <ScrollReveal key={entry.version}>
                  <div className="relative">
                    {idx < changelog.length - 1 && (
                      <div className="absolute left-[23px] top-14 bottom-0 w-px bg-border" />
                    )}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="grid h-12 w-12 place-items-center rounded-full border border-blue-400/20 bg-blue-400/10">
                          <Package className="h-5 w-5 text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-lg font-semibold">v{entry.version}</h2>
                          <Badge className={entry.type === "release" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}>
                            {entry.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Clock className="h-3.5 w-3.5" />
                          {entry.date}
                        </div>
                        <p className="text-sm font-medium text-foreground mb-4">{entry.title}</p>
                        <ul className="space-y-2">
                          {entry.changes.map((change, ci) => (
                            <li key={ci} className="flex items-start gap-3 text-sm">
                              <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeColors[change.type]}`}>
                                {change.type}
                              </span>
                              <span className="text-muted-foreground">{change.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stay updated</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              AIRIS auto-checks for updates. Run <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">airis update</code> in the CLI to update.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/download">
                  Update AIRIS <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
