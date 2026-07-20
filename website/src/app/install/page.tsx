import type { Metadata } from "next";
import { Check, Terminal, Smartphone, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InstallCommand } from "@/components/install-command";
import { InstallMethods } from "@/components/install-methods";
import { CtaSection } from "@/components/cta-section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import BlurFade from "@/components/magicui/blur-fade";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Install",
  description:
    "Install AIRIS on Linux, macOS, Windows, or Android (Termux). Binary installer, npm, or build from source.",
};

const prerequisites = [
  { icon: Terminal, label: "Node.js", value: siteConfig.nodeVersion },
  { icon: Check, label: "Git", value: "for source builds" },
  { icon: Smartphone, label: "Termux", value: "F-Droid build for Android" },
];

const faqs = [
  {
    q: "Which platforms are supported?",
    a: "Linux, macOS, and Windows-style shells on x64 and arm64. Termux is auto-detected and uses Termux-friendly paths. The binary installer fetches release assets from GitHub Releases.",
  },
  {
    q: "Do I need an account to use AIRIS?",
    a: "No. AIRIS runs locally. You only need at least one provider key or OAuth credential for the model you want to use. Keys are read from environment variables or a local auth file — never sent anywhere except your chosen provider.",
  },
  {
    q: "How do I pin a specific version?",
    a: "Set VERSION=vX.Y.Z before running the install script, e.g. VERSION=v0.79.8 curl -fsSL … | bash. From source, check out the tag you want before building.",
  },
  {
    q: "The terminal looks broken in a narrow session. What now?",
    a: "AIRIS auto-switches to a compact layout below 50 columns. If rendering is still off, check your TERM variable and avoid NO_COLOR for styled output. Set AIRIS_CLEAR_ON_SHRINK=0 if Termux repaints slowly.",
  },
];

export default function InstallPage() {
  return (
    <>
      <PageHeader
        eyebrow="Install"
        title="Up and running in one line"
        description="Pick the method that fits your environment. AIRIS installs a single airis command and gets out of your way."
      >
        <div className="w-full max-w-xl">
          <InstallCommand />
        </div>
      </PageHeader>

      <section className="container py-16">
        <div className="mx-auto grid max-w-4xl gap-10">
          <BlurFade>
            <div className="grid gap-4 sm:grid-cols-3">
              {prerequisites.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.label}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 glass"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </BlurFade>

          <BlurFade delay={0.05}>
            <InstallMethods />
          </BlurFade>

          <BlurFade delay={0.1}>
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Troubleshooting
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </BlurFade>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
