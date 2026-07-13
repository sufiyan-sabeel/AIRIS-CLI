import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Zap, Bot, Workflow, Smartphone, Eye, Code2, Cpu, Globe, Sparkles, Layers3 } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";

const roadmapItems = [
  {
    phase: "Phase 1: Foundation",
    status: "In Progress",
    statusColor: "bg-blue-400/10 text-blue-300 border-blue-400/20",
    items: [
      { title: "Multi-page marketing website", done: true, description: "Complete marketing platform with 14+ landing pages" },
      { title: "AI OS Dashboard", done: true, description: "Full dashboard with workspaces, agents, analytics" },
      { title: "Mobile Web IDE", done: true, description: "Monaco editor in browser with chat and file tree" },
      { title: "PWA Support", done: true, description: "Installable on mobile, offline-capable" },
      { title: "Backend API Enhancement", done: true, description: "WebSocket support, IDE endpoints, authentication" },
    ],
  },
  {
    phase: "Phase 2: AI Workspace",
    status: "Planned",
    statusColor: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    items: [
      { title: "Persistent Conversation Engine", done: false, description: "Multi-session chat with search and history" },
      { title: "AI Memory Management", done: false, description: "Context-aware memory across sessions" },
      { title: "Voice Chat Integration", done: false, description: "Voice input and TTS output" },
      { title: "File Upload & Analysis", done: false, description: "Upload and analyze files with AI" },
      { title: "Multi-Model Selection UI", done: false, description: "Visual provider and model picker" },
    ],
  },
  {
    phase: "Phase 3: Agent System",
    status: "Planned",
    statusColor: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    items: [
      { title: "Agent Creation Studio", done: false, description: "Visual agent designer and configuration" },
      { title: "Agent Marketplace", done: false, description: "Share and discover community agents" },
      { title: "Multi-Agent Orchestration", done: false, description: "Coordinate multiple agents for complex tasks" },
      { title: "Scheduled Agents", done: false, description: "Run agents on cron schedules" },
      { title: "Agent Analytics Dashboard", done: false, description: "Monitor agent performance and costs" },
    ],
  },
  {
    phase: "Phase 4: Workflow Studio",
    status: "Planned",
    statusColor: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    items: [
      { title: "Visual Drag-and-Drop Builder", done: false, description: "Node-based workflow editor" },
      { title: "Trigger System", done: false, description: "Webhook, schedule, event triggers" },
      { title: "AI Workflow Generation", done: false, description: "Natural language to workflow" },
      { title: "200+ Integration Nodes", done: false, description: "Pre-built connectors for popular services" },
      { title: "Execution Monitoring", done: false, description: "Logs, metrics, and replay" },
    ],
  },
  {
    phase: "Phase 5: Vision Studio",
    status: "Planned",
    statusColor: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    items: [
      { title: "Image Generation", done: false, description: "DALL-E, Stable Diffusion, and more" },
      { title: "Image Editing & OCR", done: false, description: "AI-powered image editing and text extraction" },
      { title: "Document Understanding", done: false, description: "Analyze PDFs, images, and documents" },
      { title: "Screenshot Analysis", done: false, description: "Visual reasoning and UI analysis" },
      { title: "Asset Management", done: false, description: "Media library and organization" },
    ],
  },
  {
    phase: "Phase 6: Enterprise",
    status: "Future",
    statusColor: "bg-purple-400/10 text-purple-300 border-purple-400/20",
    items: [
      { title: "Team Workspaces", done: false, description: "Collaboration and shared resources" },
      { title: "SSO & SAML", done: false, description: "Enterprise authentication" },
      { title: "Audit Logging", done: false, description: "Comprehensive activity tracking" },
      { title: "On-Premise Deployment", done: false, description: "Self-hosted enterprise option" },
      { title: "Custom SLAs", done: false, description: "Enterprise-grade support" },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Our{" "}
              <span className="gradient-text">Vision & Roadmap</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              AIRIS is evolving into a complete AI Operating System. Here is our plan to get there — and we want
              your input at every step.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI/discussions" target="_blank" rel="noreferrer">
                  Share Feedback <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="relative space-y-12 before:absolute before:left-[19px] before:top-0 before:h-full before:w-px before:bg-border">
              {roadmapItems.map((phase, idx) => (
                <ScrollReveal key={phase.phase}>
                  <div className="relative pl-12">
                    <div className={`absolute left-0 top-1 grid h-10 w-10 place-items-center rounded-full border ${
                      idx === 0 ? "border-blue-400/30 bg-blue-400/10" : "border-border bg-secondary"
                    }`}>
                      {idx === 0 ? (
                        <Zap className="h-5 w-5 text-blue-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold">{phase.phase}</h2>
                      <Badge className={phase.statusColor}>{phase.status}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {phase.items.map((item) => (
                        <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/50 p-3">
                          {item.done ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                          ) : (
                            <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <div>
                            <div className={`text-sm font-medium ${item.done ? "" : "text-muted-foreground"}`}>
                              {item.title}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Vision */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Sparkles className="mx-auto h-10 w-10 text-blue-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Our long-term vision</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              AIRIS aims to become the unified AI Operating System that combines chat, code, automation, agents,
              and system management into one seamless experience — accessible from any device, anywhere.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Bot, title: "AI-Native", description: "Every interaction is AI-augmented, from code to commands" },
                { icon: Globe, title: "Universal", description: "Works on desktop, mobile, cloud — any platform" },
                { icon: Layers3, title: "Extensible", description: "Plugin ecosystem, custom agents, unlimited integration" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm">
                  <item.icon className="mx-auto h-6 w-6 text-blue-400" />
                  <div className="mt-3 text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Want to shape the future of AIRIS?
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              We build in public. Your feedback directly influences our priorities.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI" target="_blank" rel="noreferrer">
                  Join the Community <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
