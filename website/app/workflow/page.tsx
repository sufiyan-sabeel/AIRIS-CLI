import Link from "next/link";
import { ArrowRight, Workflow, Zap, Globe, Timer, Layers3, Puzzle, ScrollText, Bot, Code2, Webhook, Sliders, GitBranch, Play, BarChart3 } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

export default function WorkflowPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/4 top-24 -z-10 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Workflow Automation Studio
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Automate anything with{" "}
              <span className="gradient-text">visual workflows</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Build powerful automations with a visual drag-and-drop interface. Connect AI agents, APIs, databases,
              and services into intelligent workflows that run on triggers or schedules.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Start Automating <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Builder Preview */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <ScrollReveal variant="slide-left">
                <SectionHeader
                  eyebrow="Visual Builder"
                  title="Drag, connect, automate"
                  description="No coding required. Our visual workflow builder lets you design complex automations by connecting nodes."
                />
                <ul className="mt-6 space-y-3">
                  {[
                    "Drag-and-drop node-based interface",
                    "200+ pre-built action nodes",
                    "Real-time validation and testing",
                    "Version history with rollback",
                    "AI-powered workflow suggestions",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Play className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
              <ScrollReveal variant="slide-right">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-2xl">
                  <div className="flex items-center border-b border-border/50 px-4 py-3">
                    <div className="flex items-center gap-2" aria-hidden>
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="ml-3 text-xs font-medium text-muted-foreground">workflow-builder.tsx</span>
                  </div>
                  <div className="space-y-2 p-4 font-mono text-xs">
                    {[
                      "Trigger: On GitHub Push",
                      "├─ Filter: branch = main",
                      "├─ Action: Run Tests",
                      "├─ AI Agent: Review Code",
                      "├─ Action: Deploy to Vercel",
                      "└─ Notify: Send to Discord",
                    ].map((line, i) => (
                      <div
                        key={line}
                        className={`rounded-md p-2 ${
                          i === 0
                            ? "bg-emerald-400/10 text-emerald-300"
                            : i === 5
                              ? "bg-blue-400/10 text-blue-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Capabilities"
              title="Powerful workflow features"
              description="Everything you need to build production-grade automations."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Zap, title: "Trigger-Based", description: "Webhook, schedule, file watch, email, and event triggers" },
                { icon: Bot, title: "AI-Powered Nodes", description: "Generate text, analyze data, make decisions with AI" },
                { icon: Globe, title: "API Integration", description: "REST, GraphQL, and custom API connectors" },
                { icon: Puzzle, title: "200+ Integrations", description: "Pre-built connectors for popular services" },
                { icon: Timer, title: "Scheduling", description: "Cron-based, interval, and calendar scheduling" },
                { icon: Layers3, title: "Nested Workflows", description: "Compose workflows within workflows" },
                { icon: ScrollText, title: "Execution Logs", description: "Full execution history with replay capability" },
                { icon: GitBranch, title: "Version Control", description: "Track changes, branch workflows, rollback" },
                { icon: BarChart3, title: "Monitoring", description: "Real-time dashboard, metrics, and alerts" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className="mb-1 h-5 w-5 text-emerald-400" />
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* Use Cases */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Use Cases"
              title="What can you automate?"
              description="Endless possibilities with AIRIS Workflow Automation Studio."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "CI/CD Pipeline", description: "Auto-build, test, and deploy on every push" },
                { title: "Data Processing", description: "Extract, transform, and load data automatically" },
                { title: "Content Publishing", description: "Generate and publish content across platforms" },
                { title: "DevOps Automation", description: "Infrastructure provisioning and monitoring" },
                { title: "Customer Onboarding", description: "Automated welcome emails and setup workflows" },
                { title: "Code Review", description: "AI-powered code review on pull requests" },
                { title: "Report Generation", description: "Scheduled data analysis and report delivery" },
                { title: "Incident Response", description: "Automated alerting and remediation workflows" },
              ].map((item) => (
                <ScrollReveal key={item.title}>
                  <Card className="glass-card hover-lift shine-card h-full">
                    <CardHeader>
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Workflow className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start building workflows
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Describe your workflow in natural language, and AIRIS will build it for you.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/download">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
