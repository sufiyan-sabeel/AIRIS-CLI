import { HeroSection } from "@/components/sections/hero-section";
import { LiveDemoSection } from "@/components/sections/live-demo-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { ArchitectureSection } from "@/components/sections/architecture-section";
import { ScreenshotsSection } from "@/components/sections/screenshots-section";
import { DocsPreviewSection } from "@/components/sections/docs-preview-section";
import { CtaSection } from "@/components/cta-section";
import BlurFade from "@/components/magicui/blur-fade";
import { providers } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Provider strip */}
      <section className="border-y border-border/50 bg-card/30 py-6">
        <div className="container">
          <BlurFade>
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Works with 20+ AI providers — bring your own key
            </p>
          </BlurFade>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {providers.slice(0, 12).map((p) => (
              <span
                key={p.name}
                className="font-mono text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {p.name}
              </span>
            ))}
            <span className="font-mono text-sm text-accent">+ more</span>
          </div>
        </div>
      </section>

      <LiveDemoSection />
      <FeaturesSection />
      <ArchitectureSection />
      <ScreenshotsSection />
      <DocsPreviewSection />
      <CtaSection />
    </>
  );
}
