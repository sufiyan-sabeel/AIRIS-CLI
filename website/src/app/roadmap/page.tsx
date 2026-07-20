import type { Metadata } from "next";
import { Check, CircleDot, Hammer, Rocket } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CtaSection } from "@/components/cta-section";
import { Badge } from "@/components/ui/badge";
import BlurFade from "@/components/magicui/blur-fade";
import { roadmap, type RoadmapMilestone } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "Where AIRIS is headed: stable core, model routing, visual verification, Android bridge, and the road to v1.0 and beyond.",
};

const statusStyle: Record<RoadmapMilestone["status"], { variant: "default" | "accent" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  Shipped: { variant: "default", icon: Check },
  "In progress": { variant: "accent", icon: Hammer },
  Planned: { variant: "outline", icon: Rocket },
};

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Roadmap"
        title="The road to a reliable core"
        description="AIRIS is built in public. These milestones are plans, not guarantees — check the CLI and release notes for what shipped."
      />

      <section className="container py-16">
        <div className="relative mx-auto max-w-3xl">
          <div className="pointer-events-none absolute left-[19px] top-2 h-full w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />
          <div className="space-y-8">
            {roadmap.map((m, i) => {
              const style = statusStyle[m.status];
              const Icon = style.icon;
              return (
                <BlurFade key={m.version} delay={i * 0.05}>
                  <div className="relative flex gap-5">
                    <span
                      className={cn(
                        "relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background",
                        m.status === "Shipped"
                          ? "border-primary/50 text-primary"
                          : m.status === "In progress"
                            ? "border-accent/50 text-accent"
                            : "border-border text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 rounded-2xl border border-border bg-card/60 p-5 glass">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-accent">
                          {m.version}
                        </span>
                        <Badge variant={style.variant}>{m.status}</Badge>
                        <h3 className="text-base font-semibold">{m.title}</h3>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {m.points.map((p) => (
                          <li
                            key={p}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <CircleDot className="mt-1 h-3 w-3 shrink-0 text-primary/60" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </BlurFade>
              );
            })}
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
