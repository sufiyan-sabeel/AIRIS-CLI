import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Code2,
  Workflow,
  Smartphone,
  Eye,
  Shield,
  Zap,
  GitBranch,
  Globe,
  Layers3,
  Cpu,
  Database,
  KeyRound,
  Terminal,
  Brush,
  Users,
  Sparkles,
  Cloud,
  Layout,
  Puzzle,
  ScrollText,
  MessagesSquare,
  FileCode2,
  Braces,
  GitPullRequest,
  Timer,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

const featureCategories = [
  {
    title: "AI & Intelligence",
    description: "Multi-provider AI with advanced capabilities",
    icon: Bot,
    features: [
      { icon: Bot, title: "Multi-Provider AI", description: "OpenAI, Anthropic, Gemini, DeepSeek, Mistral, Groq, Ollama, and 20+ providers" },
      { icon: MessagesSquare, title: "Persistent Conversations", description: "Session management with history, search, fork, and resume" },
      { icon: Brain, title: "AI Memory System", description: "Context-aware memory that persists across sessions" },
      { icon: Zap, title: "Smart Routing", description: "Automatic model routing based on task complexity and cost" },
      { icon: Cloud, title: "Local & Cloud Models", description: "Run local models via Ollama or cloud APIs" },
      { icon: Sparkles, title: "Custom System Prompts", description: "Define your own system prompts and AI personality" },
    ],
  },
  {
    title: "Code & Development",
    description: "Professional development environment",
    icon: Code2,
    features: [
      { icon: Code2, title: "AI Code Generation", description: "Generate, refactor, and optimize code with AI assistance" },
      { icon: FileCode2, title: "Multi-File Editing", description: "Read, write, edit multiple files simultaneously with precision" },
      { icon: GitBranch, title: "Git Integration", description: "Commit, branch, diff, and manage repositories" },
      { icon: Terminal, title: "Built-in Terminal", description: "Full terminal emulation with command execution and scripting" },
      { icon: Braces, title: "Language Support", description: "TypeScript, Python, Go, Rust, Java, and 50+ languages" },
      { icon: GitPullRequest, title: "Code Review", description: "AI-powered code review and diff analysis" },
    ],
  },
  {
    title: "Automation & Workflows",
    description: "Powerful automation capabilities",
    icon: Workflow,
    features: [
      { icon: Workflow, title: "Visual Workflow Builder", description: "Drag-and-drop node-based workflow automation studio" },
      { icon: Timer, title: "Trigger-Based Automation", description: "Schedule, event, and webhook-triggered automations" },
      { icon: Globe, title: "Webhook & API Integration", description: "REST, GraphQL, and webhook support for external services" },
      { icon: Layers3, title: "AI Workflow Generation", description: "Describe your workflow in natural language, AI builds it" },
      { icon: Puzzle, title: "Custom Connectors", description: "Build custom connectors for any API or service" },
      { icon: ScrollText, title: "Execution History", description: "Monitor, log, and replay workflow executions" },
    ],
  },
  {
    title: "Agent System",
    description: "Intelligent autonomous agents",
    icon: Brain,
    features: [
      { icon: Bot, title: "Agent Creation Studio", description: "Design and configure custom AI agents with specific roles" },
      { icon: Users, title: "Multi-Agent Orchestration", description: "Coordinate multiple agents working on complex tasks" },
      { icon: Timer, title: "Scheduled Agents", description: "Run agents on schedules for autonomous task execution" },
      { icon: Database, title: "Agent Memory", description: "Persistent memory and knowledge base for each agent" },
      { icon: Shield, title: "Tool Configuration", description: "Granular tool access controls and permissions" },
      { icon: BarChart3, title: "Agent Analytics", description: "Performance metrics, token usage, and success rates" },
    ],
  },
  {
    title: "Android & Mobile",
    description: "Mobile-first development platform",
    icon: Smartphone,
    features: [
      { icon: Smartphone, title: "Termux Integration", description: "Full CLI functionality on Android via Termux" },
      { icon: Cpu, title: "ADB Device Control", description: "Control Android devices via ADB from within AIRIS" },
      { icon: Eye, title: "Screen Analysis", description: "View and analyze device screenshots with AI vision" },
      { icon: Zap, title: "Voice Assistant Mode", description: "Voice-activated AI assistant with wake word support" },
      { icon: Bot, title: "Mobile AI Agents", description: "Run AI agents on your mobile device" },
      { icon: Cloud, title: "Cross-Device Sync", description: "Sync sessions and projects across all your devices" },
    ],
  },
  {
    title: "Vision & Media",
    description: "AI-powered visual capabilities",
    icon: Eye,
    features: [
      { icon: Eye, title: "Image Generation", description: "Generate images with DALL-E, Stable Diffusion, and more" },
      { icon: Brush, title: "Image Editing", description: "AI-powered image editing and manipulation" },
      { icon: ScrollText, title: "OCR & Document Understanding", description: "Extract text and understand documents" },
      { icon: Eye, title: "Visual Reasoning", description: "Analyze screenshots, diagrams, and UI mockups" },
      { icon: Layout, title: "Asset Management", description: "Organize and manage media assets" },
      { icon: FileCode2, title: "Screenshot to Code", description: "Convert designs and mockups to working code" },
    ],
  },
];

function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M6 6a3 3 0 0 1 3-3" />
      <path d="M6 18a3 3 0 0 0 3 3" />
      <path d="M18 6a3 3 0 0 0-3-3" />
      <path d="M18 18a3 3 0 0 1-3 3" />
    </svg>
  );
}

function BarChart3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

const highlights = [
  { icon: Bot, label: "AI Providers", value: "20+" },
  { icon: Code2, label: "Languages", value: "50+" },
  { icon: Users, label: "Daily Users", value: "1,000+" },
  { icon: Terminal, label: "CLI Commands", value: "40+" },
  { icon: GitBranch, label: "GitHub Stars", value: "Growing" },
  { icon: Layers3, label: "Automation Nodes", value: "100+" },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Platform Capabilities
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Everything you need in one{" "}
              <span className="gradient-text">AI Operating System</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              From AI-powered code generation to visual workflow automation, agent orchestration to mobile development —
              AIRIS combines every tool you need into one cohesive platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/brain">
                  Explore Agents <Bot className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-border/50 px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {highlights.map((item) => (
                <div key={item.label} className="text-center">
                  <item.icon className="mx-auto h-5 w-5 text-blue-400" />
                  <div className="mt-2 text-lg font-semibold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Categories */}
        {featureCategories.map((category, idx) => (
          <section
            key={category.title}
            className={`px-4 py-20 sm:px-6 sm:py-28 lg:px-8 ${
              idx % 2 === 1 ? "border-y border-border/50 bg-secondary/30" : ""
            }`}
          >
            <div className="mx-auto max-w-7xl">
              <SectionHeader
                eyebrow={category.title}
                title={category.description}
                description={`Explore the ${category.title.toLowerCase()} capabilities of AIRIS.`}
              />
              <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.features.map((feat) => (
                  <StaggerItem key={feat.title}>
                    <Card className="glass-card hover-lift shine-card h-full">
                      <CardHeader>
                        <div className="feature-icon">
                          <feat.icon className="h-5 w-5 text-blue-400" />
                        </div>
                        <CardTitle className="mt-2 text-base">{feat.title}</CardTitle>
                        <CardDescription>{feat.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerChildren>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-3xl border border-blue-400/20 bg-gradient-to-b from-blue-500/5 to-transparent p-8 sm:p-12">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to experience the{" "}
                <span className="gradient-text">AI Operating System</span>?
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Start for free. No credit card required. Join thousands of developers using AIRIS.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/download">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/pricing">
                    View Pricing
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
