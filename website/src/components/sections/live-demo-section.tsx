import { SectionHeader } from "@/components/section-header";
import { TerminalDemo } from "@/components/terminal-demo";
import { AiReasoningPreview } from "@/components/ai-reasoning-preview";
import BlurFade from "@/components/magicui/blur-fade";

export function LiveDemoSection() {
  return (
    <section id="demo" className="container py-20">
      <SectionHeader
        eyebrow="Live CLI"
        title="Two ways to watch AIRIS think"
        description="Drive a real command session in the terminal, or peek at the reasoning trace behind a single request. Both run entirely in your browser."
      />
      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-2">
        <BlurFade>
          <TerminalDemo />
        </BlurFade>
        <BlurFade delay={0.1}>
          <AiReasoningPreview className="h-full" />
        </BlurFade>
      </div>
    </section>
  );
}
