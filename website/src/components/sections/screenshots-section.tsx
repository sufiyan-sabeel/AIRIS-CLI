import { Smartphone, TerminalSquare, Workflow } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import BlurFade from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";

type MockLine = { t: "in" | "out" | "ok" | "acc" | "dim"; s: string };

function MockTerminal({ lines, className }: { lines: MockLine[]; className?: string }) {
  const color: Record<MockLine["t"], string> = {
    in: "fill-foreground",
    out: "fill-foreground/70",
    ok: "fill-emerald-400",
    acc: "fill-[hsl(187_92%_55%)]",
    dim: "fill-muted-foreground/60",
  };
  return (
    <svg
      viewBox="0 0 320 200"
      className={cn("h-full w-full", className)}
      role="img"
      aria-hidden
    >
      <rect width="320" height="200" rx="12" className="fill-[#080b13]" />
      <rect x="0.5" y="0.5" width="319" height="199" rx="12" className="fill-none stroke-border" />
      <circle cx="18" cy="16" r="3" className="fill-red-500/70" />
      <circle cx="30" cy="16" r="3" className="fill-amber-500/70" />
      <circle cx="42" cy="16" r="3" className="fill-emerald-500/70" />
      {lines.map((l, i) => (
        <text
          key={i}
          x={l.t === "in" ? 12 : 16}
          y={40 + i * 18}
          className={cn("font-mono", color[l.t])}
          style={{ fontSize: "8.5px" }}
        >
          {l.t === "in" ? `$ ${l.s}` : l.s}
        </text>
      ))}
    </svg>
  );
}

const mockups = [
  {
    icon: TerminalSquare,
    title: "Interactive session",
    caption: "Conversational coding in any shell.",
    lines: [
      { t: "in", s: "airis" },
      { t: "acc", s: "› How can I help today?" },
      { t: "out", s: "Reviewing src/ and tests…" },
      { t: "ok", s: "✓ 3 issues found, 0 critical" },
      { t: "dim", s: "type a message or -p" },
    ] as MockLine[],
  },
  {
    icon: Workflow,
    title: "Ship workflow",
    caption: "Contract → plan → verify → proof.",
    lines: [
      { t: "in", s: 'airis ship start "auth"' },
      { t: "acc", s: "› Contract created" },
      { t: "ok", s: "✓ Planning (3 steps)" },
      { t: "ok", s: "✓ Verification passed" },
      { t: "dim", s: "proof report ready" },
    ] as MockLine[],
  },
  {
    icon: Smartphone,
    title: "Termux on Android",
    caption: "A full agent in your pocket.",
    lines: [
      { t: "in", s: "airis -p \"fix lint\"" },
      { t: "out", s: "Running on Termux…" },
      { t: "ok", s: "✓ 12 files formatted" },
      { t: "acc", s: "› Ready for commit" },
      { t: "dim", s: "tap to continue" },
    ] as MockLine[],
  },
];

export function ScreenshotsSection() {
  return (
    <section id="screenshots" className="container py-20">
      <SectionHeader
        eyebrow="In the wild"
        title="One agent, every surface"
        description="AIRIS adapts to the terminal you have — wide desktop layouts, narrow SSH sessions, or a phone running Termux."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {mockups.map((m, i) => {
          const Icon = m.icon;
          return (
            <BlurFade key={m.title} delay={i * 0.08}>
              <div className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_40px_-16px_hsl(var(--primary)/0.6)] glass">
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <MockTerminal lines={m.lines} />
                </div>
                <div className="flex items-start gap-3 px-1 pb-1">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{m.title}</h3>
                    <p className="text-xs text-muted-foreground">{m.caption}</p>
                  </div>
                </div>
              </div>
            </BlurFade>
          );
        })}
      </div>
    </section>
  );
}
