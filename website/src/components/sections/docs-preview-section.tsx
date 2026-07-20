import Link from "next/link";
import { ArrowUpRight, BookOpen, Terminal, Bot, Layers3 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import BlurFade from "@/components/magicui/blur-fade";
import { CodeBlock } from "@/components/code-block";

const docs = [
  {
    icon: BookOpen,
    title: "Getting started",
    desc: "Install, set a provider key, and run your first prompt in under a minute.",
    href: "/docs#getting-started",
  },
  {
    icon: Terminal,
    title: "Command reference",
    desc: "Every flag and subcommand, from core to developer mode.",
    href: "/docs#commands",
  },
  {
    icon: Bot,
    title: "AI providers",
    desc: "Wire up 20+ providers and local models through one interface.",
    href: "/providers",
  },
  {
    icon: Layers3,
    title: "Ship workflow",
    desc: "Run a full development lifecycle with verification and proof.",
    href: "/docs#ship",
  },
];

export function DocsPreviewSection() {
  return (
    <section id="docs-preview" className="container py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionHeader
            align="left"
            eyebrow="Documentation"
            title="Docs that respect your time"
            description="Task-first guides, a complete command reference, and copy-paste snippets. No fluff, just what you need to ship."
          />
          <CodeBlock
            filename="quickstart.sh"
            lang="bash"
            code={`# 1. install
curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash

# 2. set a provider key
export GEMINI_AAIRIS_KEY="your-key"

# 3. go
airis -p "explain this codebase"`}
          />
          <div className="flex flex-wrap gap-3">
            {docs.map((d) => (
              <Link
                key={d.title}
                href={d.href}
                className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm transition-colors hover:border-primary/40"
              >
                <d.icon className="h-4 w-4 text-accent" />
                {d.title}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d, i) => (
            <BlurFade key={d.title} delay={i * 0.06}>
              <Link
                href={d.href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card/60 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 glass"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-accent">
                  <d.icon className="h-5 w-5" />
                </span>
                <h3 className="flex items-center gap-1 text-sm font-semibold">
                  {d.title}
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-muted-foreground">{d.desc}</p>
              </Link>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
