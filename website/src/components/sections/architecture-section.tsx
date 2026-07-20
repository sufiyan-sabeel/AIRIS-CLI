import { SectionHeader } from "@/components/section-header";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import BlurFade from "@/components/magicui/blur-fade";

export function ArchitectureSection() {
  return (
    <section id="architecture" className="container py-20">
      <SectionHeader
        eyebrow="Architecture"
        title="Layered, local-first, and provider-agnostic"
        description="AIRIS is a thin, composable stack. The terminal UI talks to an agent core, which drives tools and a unified provider layer — all behind an extension runtime you control."
      />
      <BlurFade delay={0.1} className="mt-12">
        <ArchitectureDiagram />
      </BlurFade>
    </section>
  );
}
