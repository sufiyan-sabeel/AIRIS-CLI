import Link from "next/link";
import { ArrowRight, Bot, Brain, Cpu, Database, GitBranch, Layers3, Network, Shield, Sparkles, Timer, Users, Workflow, Zap } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

export default function BrainPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/3 top-12 -z-10 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" aria-hidden />
          <div className="absolute right-1/4 top-24 -z-10 h-64 w-64 rounded-full bg-blue-500/8 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              AIRIS Brain & Agent System
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              The <span className="gradient-text">Brain</span> behind the operation
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              AIRIS Brain is the central intelligence layer that powers autonomous agents, orchestrates complex workflows,
              and manages AI memory. Create, deploy, and monitor intelligent agents that work for you.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Start Building Agents <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Brain Architecture */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Architecture"
              title="How AIRIS Brain works"
              description="A multi-layered intelligence system that learns, reasons, and acts autonomously."
            />
            <StaggerChildren staggerDelay={0.08} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Brain, title: "Perception Layer", description: "Processes inputs from multiple sources — code, files, APIs, voice, images" },
                { icon: Network, title: "Reasoning Engine", description: "Multi-model reasoning with chain-of-thought, tool selection, and planning" },
                { icon: Database, title: "Memory System", description: "Episodic, semantic, and procedural memory that persists across sessions" },
                { icon: Zap, title: "Action Layer", description: "Executes tools, runs commands, edits files, calls APIs, controls devices" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card shine-card hover-lift h-full text-center">
                    <CardHeader className="items-center">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-purple-400/20 bg-purple-400/10">
                        <item.icon className="h-7 w-7 text-purple-400" />
                      </div>
                      <CardTitle className="mt-3 text-base">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* Agent Studio */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Agent Creation Studio"
              title="Design intelligent agents"
              description="Create specialized AI agents with custom capabilities, tools, and memory."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Bot, title: "Custom Agents", description: "Design agents with specific roles, tools, and knowledge bases" },
                { icon: Users, title: "Multi-Agent Teams", description: "Orchestrate teams of agents working together on complex tasks" },
                { icon: Timer, title: "Scheduled Execution", description: "Run agents on schedules for autonomous background work" },
                { icon: Shield, title: "Permission Controls", description: "Granular tool access, capability leasing, and trust settings" },
                { icon: Database, title: "Persistent Memory", description: "Agents remember context, learn from interactions, and build knowledge" },
                { icon: GitBranch, title: "Version History", description: "Track agent configurations, roll back changes, and fork agents" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className="mb-1 h-5 w-5 text-purple-400" />
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* Agent Types */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Pre-built Agents"
              title="Ready-to-use agent templates"
              description="Start with proven agent configurations and customize them for your needs."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Code Assistant", description: "Helps write, review, and debug code across 50+ languages", popular: true },
                { name: "DevOps Agent", description: "Manages deployments, CI/CD, infrastructure, and monitoring", popular: false },
                { name: "Research Agent", description: "Searches the web, analyzes documents, and synthesizes findings", popular: true },
                { name: "Data Analyst", description: "Queries databases, visualizes data, and generates reports", popular: false },
                { name: "Automation Agent", description: "Creates and executes automated workflows and scheduled tasks", popular: false },
                { name: "Security Agent", description: "Audits code, scans for vulnerabilities, and monitors compliance", popular: false },
                { name: "Content Creator", description: "Generates blog posts, documentation, and marketing content", popular: false },
                { name: "Testing Agent", description: "Writes and runs tests, generates test data, and reports coverage", popular: true },
                { name: "Assistant Agent", description: "General-purpose AI assistant for daily tasks and questions", popular: false },
              ].map((agent) => (
                <ScrollReveal key={agent.name}>
                  <Card className="glass-card hover-lift shine-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Bot className="h-5 w-5 text-purple-400" />
                        {agent.popular && <Badge className="border-purple-400/30 text-purple-400">Popular</Badge>}
                      </div>
                      <CardTitle className="mt-2 text-sm">{agent.name}</CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Orchestration */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <ScrollReveal variant="slide-left">
                <SectionHeader
                  eyebrow="Multi-Agent Orchestration"
                  title="Coordinate complex agent teams"
                  description="Chain multiple agents together to solve complex problems that no single agent can handle alone."
                />
                <ul className="mt-6 space-y-4">
                  {[
                    "Sequential pipelines: Agent A outputs → Agent B processes → Agent C delivers",
                    "Parallel execution: Multiple agents work simultaneously on different subtasks",
                    "Hierarchical: Manager agent delegates to specialized worker agents",
                    "Competitive: Multiple agents propose solutions, best one wins",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
              <ScrollReveal variant="slide-right">
                <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <Layers3 className="h-4 w-4 text-purple-400" />
                    Agent Pipeline Example
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 text-blue-300">
                      ┌─ Research Agent: "Analyze competitor pricing"
                    </div>
                    <div className="pl-6 text-muted-foreground">│</div>
                    <div className="rounded-lg border border-purple-400/20 bg-purple-400/5 p-3 text-purple-300">
                      ├─ Data Analyst: "Extract and visualize trends"
                    </div>
                    <div className="pl-6 text-muted-foreground">│</div>
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-emerald-300">
                      └─ Content Agent: "Generate pricing report"
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-3xl border border-purple-400/20 bg-gradient-to-b from-purple-500/5 to-transparent p-8 sm:p-12">
              <Brain className="mx-auto h-10 w-10 text-purple-400" />
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Build your first agent today
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Start with a template or create from scratch. AIRIS makes agent development accessible to everyone.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/download">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
