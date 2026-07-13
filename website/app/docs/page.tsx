import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Terminal,
  FileCode2,
  Bot,
  Workflow,
  Shield,
  Smartphone,
  ExternalLink,
  Search,
  ChevronRight,
  GraduationCap,
  BookMarked,
  Blocks,
  GitBranch,
  Puzzle,
  Users,
  Cpu,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";
import { Badge } from "@/components/ui/badge";

const docSections = [
  {
    title: "Getting Started",
    description: "New to AIRIS? Start here.",
    icon: GraduationCap,
    color: "blue",
    links: [
      { title: "Quick Start Guide", href: "/docs/getting-started", description: "Set up AIRIS in 5 minutes" },
      { title: "Installation", href: "/download", description: "All installation methods" },
      { title: "Provider Setup", href: "/docs/providers", description: "Configure AI providers" },
      { title: "First Session", href: "/docs/first-session", description: "Run your first AI session" },
    ],
  },
  {
    title: "CLI Reference",
    description: "Complete command documentation.",
    icon: Terminal,
    color: "emerald",
    links: [
      { title: "Command Overview", href: "/docs/cli", description: "All CLI commands" },
      { title: "Session Management", href: "/docs/sessions", description: "Save, resume, fork sessions" },
      { title: "AI Commands", href: "/docs/ai-commands", description: "Provider and model options" },
      { title: "Ship Workflow", href: "/docs/ship", description: "Full development workflow" },
    ],
  },
  {
    title: "API Reference",
    description: "Integrate with AIRIS programmatically.",
    icon: Code2,
    color: "purple",
    links: [
      { title: "REST API", href: "/docs/api/rest", description: "HTTP API endpoints" },
      { title: "WebSocket API", href: "/docs/api/websocket", description: "Real-time communication" },
      { title: "SDK Documentation", href: "/docs/sdk", description: "TypeScript/JavaScript SDK" },
      { title: "GraphQL API", href: "/docs/api/graphql", description: "GraphQL endpoints" },
    ],
  },
  {
    title: "Agent Development",
    description: "Build and deploy AI agents.",
    icon: Bot,
    color: "violet",
    links: [
      { title: "Agent Fundamentals", href: "/docs/agents", description: "How agents work" },
      { title: "Tool Configuration", href: "/docs/agents/tools", description: "Custom tools and permissions" },
      { title: "Agent Memory", href: "/docs/agents/memory", description: "Persistent agent memory" },
      { title: "Multi-Agent Systems", href: "/docs/agents/multi-agent", description: "Orchestrate agent teams" },
    ],
  },
  {
    title: "Workflow Automation",
    description: "Build automated workflows.",
    icon: Workflow,
    color: "emerald",
    links: [
      { title: "Workflow Basics", href: "/docs/workflows", description: "Creating workflows" },
      { title: "Node Reference", href: "/docs/workflows/nodes", description: "All workflow nodes" },
      { title: "Triggers & Events", href: "/docs/workflows/triggers", description: "Trigger types and setup" },
      { title: "Integration Guide", href: "/docs/integrations", description: "Connect external services" },
    ],
  },
  {
    title: "Extension Development",
    description: "Extend AIRIS capabilities.",
    icon: Puzzle,
    color: "amber",
    links: [
      { title: "Extension API", href: "/docs/extensions", description: "Build AIRIS extensions" },
      { title: "Plugin Development", href: "/docs/plugins", description: "Create plugins" },
      { title: "Theme System", href: "/docs/themes", description: "Custom themes" },
      { title: "Skills System", href: "/docs/skills", description: "Create custom skills" },
    ],
  },
  {
    title: "Security & Trust",
    description: "Keep your workspace secure.",
    icon: Shield,
    color: "red",
    links: [
      { title: "Trust Model", href: "/docs/security/trust", description: "Project trust system" },
      { title: "Permission Controls", href: "/docs/security/permissions", description: "Granular permissions" },
      { title: "Verified Autonomy", href: "/docs/security/verified-autonomy", description: "Mission contracts and leases" },
      { title: "Security Best Practices", href: "/docs/security", description: "Security guidelines" },
    ],
  },
  {
    title: "Platform Guides",
    description: "Platform-specific documentation.",
    icon: Cpu,
    color: "cyan",
    links: [
      { title: "Android / Termux", href: "/docs/termux", description: "Running on Android" },
      { title: "ADB Automation", href: "/docs/adb", description: "Android device control" },
      { title: "Docker Deployment", href: "/docs/docker", description: "Running in containers" },
      { title: "CI/CD Integration", href: "/docs/cicd", description: "GitHub Actions, GitLab CI" },
    ],
  },
];

const quickLinks = [
  { icon: BookOpen, title: "Installation Guide", href: "/download", description: "Get AIRIS running" },
  { icon: Terminal, title: "CLI Reference", href: "/docs/cli", description: "All commands" },
  { icon: Code2, title: "API Docs", href: "/docs/api/rest", description: "REST & WebSocket" },
  { icon: GraduationCap, title: "Quick Start", href: "/docs/getting-started", description: "5-minute guide" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Documentation
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Everything you need to build with{" "}
              <span className="gradient-text">AIRIS</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Comprehensive documentation, guides, and API references to help you get the most out of AIRIS.
            </p>
            <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-border/50 bg-card/60 p-2 backdrop-blur-sm">
              <Search className="ml-2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documentation..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="hidden rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">
                Ctrl+K
              </kbd>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Link key={link.title} href={link.href}>
                  <Card className="glass-card hover-lift">
                    <CardHeader className="flex-row items-center gap-3">
                      <link.icon className="h-5 w-5 text-blue-400 shrink-0" />
                      <div>
                        <CardTitle className="text-sm">{link.title}</CardTitle>
                        <CardDescription>{link.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Documentation Sections */}
        <section className="px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-2">
              {docSections.map((section) => (
                <ScrollReveal key={section.title}>
                  <Card className="glass-card hover-lift shine-card">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl border bg-${section.color}-400/10 border-${section.color}-400/20`}>
                          <section.icon className={`h-5 w-5 text-${section.color}-400`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{section.title}</CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.links.map((link) => (
                          <li key={link.title}>
                            <Link href={link.href} className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-secondary">
                              <div>
                                <div className="text-sm font-medium group-hover:text-foreground">{link.title}</div>
                                <div className="text-xs text-muted-foreground">{link.description}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Community */}
        <section className="border-t border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Users className="mx-auto h-10 w-10 text-blue-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Community resources
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Get help from the community, contribute to documentation, or report issues.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline">
                <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI/discussions" target="_blank" rel="noreferrer">
                  GitHub Discussions <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI/issues" target="_blank" rel="noreferrer">
                  Report Issue <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI" target="_blank" rel="noreferrer">
                  Contribute <ExternalLink className="h-4 w-4" />
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
