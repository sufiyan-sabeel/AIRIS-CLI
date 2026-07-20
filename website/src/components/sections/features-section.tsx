import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { FeatureCard } from "@/components/feature-card";
import BlurFade from "@/components/magicui/blur-fade";
import { Button } from "@/components/ui/button";
import { features } from "@/lib/site";

export function FeaturesSection() {
  return (
    <section id="features" className="container py-20">
      <SectionHeader
        eyebrow="Capabilities"
        title="Everything a terminal agent should be"
        description="AIRIS pairs a calm, adaptive interface with serious engineering — sessions, trust controls, verified autonomy, and a plugin runtime you can extend."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <BlurFade key={feature.title} delay={i * 0.04}>
            <FeatureCard feature={feature} className="h-full" />
          </BlurFade>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/features">
            Explore all features
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
