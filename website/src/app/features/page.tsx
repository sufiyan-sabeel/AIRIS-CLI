import type { Metadata } from "next";
import { Cpu, Lock, Plug, Smartphone, Workflow, Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FeatureCard } from "@/components/feature-card";
import { CtaSection } from "@/components/cta-section";
import BlurFade from "@/components/magicui/blur-fade";
import { features } from "@/lib/site";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore AIRIS capabilities: interactive terminal UI, sessions, project trust, multi-provider routing, verified autonomy, extensions, themes, and Android support.",
};

const principles = [
  {
    icon: Lock,
    title: "Local-first & auditable",
    body: "Runs with your user permissions, on your machine. Verified autonomy leaves evidence you can read.",
  },
  {
    icon: Plug,
    title: "Extensible by design",
    body: "TypeScript extensions, Agent Skills, and prompt templates load on demand — core stays small.",
  },
  {
    icon: Smartphone,
    title: "Mobile-native",
    body: "Built for Termux and ADB. The adaptive UI works from a 40-column SSH session to a wide desktop.",
  },
  {
    icon: Workflow,
    title: "Workflows, not just chat",
    body: "Ship, missions, and sessions turn one-off prompts into tracked, repeatable development work.",
  },
  {
    icon: Cpu,
    title: "Provider-agnostic",
    body: "20+ cloud providers and any OpenAI-compatible local model behind one streaming interface.",
  },
  {
    icon: Boxes,
    title: "Composable stack",
    body: "A thin TUI over an agent core, tool layer, and provider layer — easy to reason about and extend.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Capabilities"
        title="A terminal agent with real engineering behind it"
        description="AIRIS is more than a chatbot in a shell. It is a composable, auditable, and extensible harness for everyday development."
      />

      <section className="container py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <BlurFade key={feature.title} delay={i * 0.03}>
              <FeatureCard feature={feature} className="h-full" />
            </BlurFade>
          ))}
        </div>
      </section>

      <section className="container py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {principles.map((p, i) => {
            const Icon = p.icon;
            return (
              <BlurFade key={p.title} delay={i * 0.04}>
                <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card/60 p-5 glass">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                </div>
              </BlurFade>
            );
          })}
        </div>
      </section>

      <CtaSection />
    </>
  );
}
