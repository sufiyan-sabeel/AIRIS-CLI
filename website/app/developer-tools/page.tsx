import Link from "next/link";
import { ArrowRight, Code2, Terminal, GitBranch, Puzzle, FileCode2, Globe, Wrench, Braces, Container, Cloud, TestTube } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

export default function DeveloperToolsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <Code2 className="h-3 w-3 text-blue-400" />
              <span>Developer Tools</span>
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Build, debug, and deploy with{" "}
              <span className="gradient-text">AI-powered tools</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Everything you need for modern development — from browser-based code editing to CLI tools, API testing, and deployment orchestration.
            </p>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Workspace"
              title="Professional development environment"
              description="Browser-based or CLI — AIRIS gives you a complete development toolkit."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Code2, title: "Code Editor", description: "Monaco-based editor with syntax highlighting, IntelliSense, and AI completions" },
                { icon: Terminal, title: "Integrated Terminal", description: "Full terminal emulator with shell access and command execution" },
                { icon: GitBranch, title: "Git Integration", description: "Clone, commit, push, branch, and review — all from one interface" },
                { icon: FileCode2, title: "File Explorer", description: "Browse, search, and manage project files with context menu actions" },
                { icon: Globe, title: "API Testing", description: "Built-in HTTP client for testing REST, GraphQL, and WebSocket APIs" },
                { icon: Puzzle, title: "Extension System", description: "Extend AIRIS with custom plugins, themes, and tools" },
                { icon: Container, title: "Docker Support", description: "Manage containers, images, and Docker Compose workflows" },
                { icon: Cloud, title: "Deployment Tools", description: "Deploy to Vercel, Netlify, Railway, and more with one click" },
                { icon: TestTube, title: "Testing Tools", description: "Run tests, view coverage, and debug with integrated tooling" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className="mb-1 h-5 w-5 text-blue-400" />
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
          <div className="mx-auto max-w-7xl text-center">
            <Code2 className="mx-auto h-10 w-10 text-blue-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Try the AIRIS Web IDE
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Open the browser-based code editor with AI chat, file tree, and terminal. Works on mobile and desktop.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/ide">
                Open Web IDE <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
