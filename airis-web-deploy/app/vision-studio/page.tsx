import Link from "next/link";
import { ArrowRight, Eye, Image, FileText, ScanLine, Brush, Layout, Sparkles, Palette, Crop, Wand2, Search } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

export default function VisionStudioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/3 top-12 -z-10 h-72 w-72 rounded-full bg-violet-500/8 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <Eye className="h-3 w-3 text-violet-400" />
              <span>AIRIS Vision Studio</span>
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              See, understand, and create with{" "}
              <span className="gradient-text">AI Vision</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Generate images, extract text, analyze documents, and reason about visual content — all powered by AI.
            </p>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Capabilities"
              title="Visual AI tools"
              description="Everything you need for AI-powered visual work."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Image, title: "Image Generation", description: "Generate images from text descriptions using DALL-E, Stable Diffusion, and more" },
                { icon: Brush, title: "Image Editing", description: "Edit images with natural language instructions" },
                { icon: FileText, title: "OCR & Document Understanding", description: "Extract text and understand document structure" },
                { icon: ScanLine, title: "Screenshot Analysis", description: "Analyze screenshots and UI designs with AI" },
                { icon: Eye, title: "Visual Reasoning", description: "Ask questions about images and get intelligent answers" },
                { icon: Layout, title: "Asset Management", description: "Organize, tag, and search your media assets" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className="mb-1 h-5 w-5 text-violet-400" />
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Coming to the web platform soon
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The Vision Studio is in active development. AI vision capabilities are available now through the CLI.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/download">
                Try Vision in CLI <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
