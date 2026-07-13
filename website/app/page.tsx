import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Github,
  KeyRound,
  Smartphone,
  Cpu,
  ShieldCheck,
  Terminal,
  Bot,
  Monitor,
  Sparkles,
  Workflow,
  Globe,
  Zap,
  ChevronRight,
  Layers3,
  FileCode2,
  GitBranch,
  Palette,
  Wrench,
  Braces,
  ClipboardCheck,
  TerminalSquare,
  MessageSquare,
  Eye,
  Code2,
  BookOpen,
  Users,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/code-block";
import { TerminalDemo } from "@/components/terminal-demo";
import { VideoProof } from "@/components/video-proof";
import { SectionHeader } from "@/components/section-header";
import { FeatureCard } from "@/components/feature-card";
import { CommandExplorer } from "@/components/command-explorer";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Badge } from "@/components/ui/badge";
import {
  repo,
  navItems,
  features,
  providers,
  workflowPhases,
  airisIdeFeatures,
  termuxCommands,
} from "@/data/site";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main-content">
        {/* ═══════════════════════════════════════════════════════
           HERO
           ═══════════════════════════════════════════════════════ */}
        <section className="hero-gradient relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-16 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="bg-grid absolute inset-0 -z-10 opacity-70" aria-hidden />
          <div className="scanline absolute inset-x-0 top-0 -z-10 h-1/2 opacity-20" aria-hidden />

          <div className="orb-blue absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
          <div className="orb-cyan absolute -right-32 top-16 -z-10 h-96 w-96 rounded-full bg-cyan-500/6 blur-3xl" aria-hidden />
          <div className="orb-blue-slow absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl" aria-hidden />
          <div className="orb-pulse absolute left-1/2 top-1/3 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/4 blur-3xl" aria-hidden />

          <div className="mx-auto max-w-7xl">
            <div className="fade-up text-center">
              {/* Eyebrow */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {repo.fullName}
              </div>

              {/* Main Headline */}
              <h1 className="mx-auto max-w-5xl text-balance text-[clamp(2.25rem,6vw,4.5rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
                AI-Powered{" "}
                <span className="gradient-text">Command-Line</span>
                {" "}Assistant
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                An intelligent coding agent that lives in your terminal.
                Built for developers who want AI assistance without leaving the command line.
              </p>

              {/* CTAs */}
              <div className="fade-up fade-up-delay-1 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="pulse-cta">
                  <a href="#installation">
                    Install AIRIS <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#demo">
                    <Monitor className="h-4 w-4" /> Watch Demo
                  </a>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href={repo.url} target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" /> GitHub
                  </a>
                </Button>
              </div>
            </div>

            {/* Terminal Preview */}
            <div className="fade-up fade-up-delay-2 mx-auto mt-14 max-w-3xl sm:mt-16">
              <div className="terminal-orbit relative">
                <div className="float-medium absolute -left-2 -top-3 z-10 rounded-full border border-blue-400/20 bg-background/80 px-3 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md sm:-left-3 sm:-top-4 sm:px-3.5 sm:py-1 sm:text-xs">
                  npm global install
                </div>
                <div className="float-slow float-delay absolute -right-2 -bottom-3 z-10 rounded-full border border-cyan-400/20 bg-background/80 px-3 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md sm:-right-2 sm:-bottom-4 sm:px-3.5 sm:py-1 sm:text-xs">
                  multi-provider AI
                </div>
                <TerminalDemo />
              </div>
            </div>

            {/* Quick Info */}
            <ScrollReveal delay={0.5} duration={0.5}>
              <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 text-xs sm:gap-4 sm:text-sm md:grid-cols-4">
                {[
                  { label: "Creator", value: repo.creator },
                  { label: "Version", value: `v${repo.version}` },
                  { label: "License", value: repo.license },
                  { label: "Node", value: `>=${repo.node}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border/40 bg-card/60 p-3 text-center backdrop-blur-sm sm:rounded-2xl sm:p-4"
                  >
                    <dt className="text-xs text-muted-foreground sm:text-sm">{item.label}</dt>
                    <dd className="mt-1 font-semibold tracking-tight text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FEATURES
           ═══════════════════════════════════════════════════════ */}
        <section id="features" aria-labelledby="features-heading" className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid-subtle absolute inset-0 -z-10" aria-hidden />
          <div className="absolute left-1/2 top-24 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/8 blur-3xl" aria-hidden />

          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Capabilities"
              title="Everything you need in the terminal"
              description="AIRIS-CLI combines AI assistance with developer tooling for a seamless command-line workflow."
            />

            <StaggerChildren
              staggerDelay={0.07}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((feature) => (
                <StaggerItem key={feature.title}>
                  <FeatureCard
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    evidence={feature.evidence}
                  />
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           DEMO / VIDEO
           ═══════════════════════════════════════════════════════ */}
        <section id="demo" aria-labelledby="demo-heading" className="relative isolate overflow-hidden border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid-subtle absolute inset-0 -z-10" aria-hidden />
          <div className="mx-auto max-w-5xl">
            <SectionHeader
              eyebrow="Live Demo"
              title="See AIRIS CLI in action"
              description="Watch the installation process and see how AIRIS works in the terminal."
            />
            <VideoProof />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           INSTALL
           ═══════════════════════════════════════════════════════ */}
        <section id="installation" aria-labelledby="install-heading" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Installation"
              title="Get started in minutes"
              description={`Node.js ${repo.node} required. Choose your preferred installation method below.`}
            />

            <StaggerChildren staggerDelay={0.08} className="grid gap-4 lg:grid-cols-3">
              <StaggerItem>
                <Card className="glass-card hover-lift h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="feature-icon">
                        <Terminal className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <CardTitle>Quick install</CardTitle>
                        <CardDescription>One-line curl install</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock code="curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash" />
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="glass-card hover-lift h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="feature-icon">
                        <Github className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <CardTitle>npm install</CardTitle>
                        <CardDescription>Install globally via npm</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock code="npm install -g @sufiyan-sabeel/airis-cli" />
                    <CodeBlock code="airis --help" />
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="glass-card hover-lift h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="feature-icon">
                        <Github className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <CardTitle>Source build</CardTitle>
                        <CardDescription>Clone and build from source</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock code={`git clone https://github.com/sufiyan-sabeel/AIRIS-CLI.git\ncd AIRIS-CLI\nnpm install\nnpm run build`} />
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem className="lg:col-span-3">
                <Card className="glass-card hover-lift">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="feature-icon">
                        <Smartphone className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle>Termux install</CardTitle>
                        <CardDescription>Install on Android via Termux</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CodeBlock code={`pkg update\npkg install nodejs git\nnpm install -g @sufiyan-sabeel/airis-cli\nairis --version`} />
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerChildren>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           QUICK START
           ═══════════════════════════════════════════════════════ */}
        <section id="quick-start" className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 lg:gap-12">
            <ScrollReveal variant="slide-left" className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500/70" />
                Quick start
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Start from the terminal you already use.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Set up a provider API key, launch interactive mode, or run one-shot prompts.
                AIRIS works with multiple AI providers.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Card className="glass-card hover-lift">
                  <CardHeader>
                    <KeyRound className="mb-2 h-5 w-5 text-blue-400" />
                    <CardTitle>Provider key</CardTitle>
                    <CardDescription>
                      Use an environment variable like{" "}
                      <code className="rounded bg-secondary px-1 font-mono text-xs">GEMINI_AAIRIS_KEY</code> or{" "}
                      <code className="rounded bg-secondary px-1 font-mono text-xs">OPENAI_AAIRIS_KEY</code>.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="glass-card hover-lift">
                  <CardHeader>
                    <Terminal className="mb-2 h-5 w-5 text-blue-400" />
                    <CardTitle>CLI modes</CardTitle>
                    <CardDescription>
                      Run interactive with{" "}
                      <code className="rounded bg-secondary px-1 font-mono text-xs">airis</code>, or one-shot with{" "}
                      <code className="rounded bg-secondary px-1 font-mono text-xs">airis -p</code>.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="slide-right">
              <CodeBlock
                code={
                  'export GEMINI_AAIRIS_KEY="your-key"\n# or export OPENAI_AAIRIS_KEY="your-key"\n# or export ANTHROPIC_AAIRIS_KEY="your-key"\n\nairis\nairis -p "List all TypeScript files in src/"\nairis --continue'
                }
              />
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           WORKFLOW
           ═══════════════════════════════════════════════════════ */}
        <section id="workflow" aria-labelledby="workflow-heading" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="airis ship"
              title="Full-lifecycle workflow"
              description="The `airis ship` workflow moves from request and contract through testing, verification, proof, and optional commit."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              {workflowPhases.map((phase, index) => (
                <StaggerItem key={phase}>
                  <Card className="glass-card hover-lift relative overflow-hidden">
                    <CardHeader>
                      <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <CardTitle className="mt-2 text-sm font-medium">{phase}</CardTitle>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           COMMAND EXPLORER
           ═══════════════════════════════════════════════════════ */}
        <section id="commands" aria-labelledby="commands-heading" className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid-dense absolute inset-0 -z-10" aria-hidden />
          <div className="mx-auto max-w-5xl">
            <SectionHeader
              eyebrow="Command Reference"
              title="Explore AIRIS CLI commands"
              description="Search and browse available commands, their descriptions, and usage patterns."
            />
            <ScrollReveal variant="slide-up-scale">
              <CommandExplorer />
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           TERMUX / ANDROID
           ═══════════════════════════════════════════════════════ */}
        <section id="termux" className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid-subtle absolute inset-0 -z-10" aria-hidden />
          <div className="absolute left-1/4 top-12 -z-10 h-64 w-64 rounded-full bg-emerald-500/8 blur-3xl" aria-hidden />

          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Mobile Development"
              title="Android & Termux Ready"
              description="AIRIS works seamlessly with Termux workflows. Mobile-first development is a core goal of the project."
            />

            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <ScrollReveal variant="slide-left" className="space-y-6">
                <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Run AIRIS directly on your Android device through Termux — a powerful terminal emulator for Android.
                  No cloud dependency required.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="glass-card hover-lift">
                    <CardHeader>
                      <Smartphone className="mb-2 h-5 w-5 text-emerald-400" />
                      <CardTitle>Termux Native</CardTitle>
                      <CardDescription>Install and run AIRIS inside Termux with pkg and npm. Full CLI functionality available on mobile.</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card className="glass-card hover-lift">
                    <CardHeader>
                      <Cpu className="mb-2 h-5 w-5 text-emerald-400" />
                      <CardTitle>Linux Home Build</CardTitle>
                      <CardDescription>Build from Termux/Linux home directory, not Android shared storage, for best performance.</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Android Compatible
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Termux Optimized
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Mobile-First
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal variant="slide-right">
                <CodeBlock code={termuxCommands.join("\n")} />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  After installation, run{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">airis --help</code>{" "}
                  to explore available commands.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           AIRIS IDE
           ═══════════════════════════════════════════════════════ */}
        <section id="airis-ide" className="relative isolate overflow-hidden border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid-subtle absolute inset-0 -z-10" aria-hidden />
          <div className="absolute right-1/4 top-12 -z-10 h-72 w-72 rounded-full bg-violet-500/8 blur-3xl" aria-hidden />

          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <ScrollReveal variant="slide-left">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Available Now
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Web + Mobile PWA
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">AIRIS Web IDE</h2>
                <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  A full-featured code editor with AI assistance, file explorer, terminal, and project management —
                  running entirely in your browser with PWA support for mobile.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Features Monaco editor, AI chat panel, file tree, integrated terminal, diff viewer, and multi-provider AI support.
                  Installable on Android and iOS via &quot;Add to Home Screen&quot;.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg" variant="primary">
                    <Link href="/ide">
                      <Sparkles className="h-4 w-4" /> Try AIRIS IDE <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href={repo.url} target="_blank" rel="noreferrer">
                      View Roadmap <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </ScrollReveal>

              <ScrollReveal variant="slide-right">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-violet-950/10 dark:bg-black sm:rounded-3xl">
                  <div className="flex items-center border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2" aria-hidden>
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400 sm:h-3 sm:w-3" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 sm:h-3 sm:w-3" />
                    </div>
                    <span className="ml-3 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 font-mono text-xs text-violet-200">
                      airis-ide (active)
                    </span>
                  </div>
                  <div className="space-y-3 p-5 font-mono text-xs leading-6 text-zinc-400 sm:p-6 sm:text-sm sm:leading-7">
                    {[
                      { icon: Zap, text: "AI Coding Workflows" },
                      { icon: Workflow, text: "Automation Designer" },
                      { icon: Globe, text: "Project Views" },
                      { icon: Terminal, text: "Integrated Terminal" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-zinc-500">
                        <Icon className="h-3.5 w-3.5 text-violet-400" /> {text}
                      </div>
                    ))}
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3.5 text-center text-xs text-emerald-300 sm:mt-4 sm:p-4 sm:text-sm">
                      Available now — open in your browser
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="mt-14 lg:mt-20">
              <SectionHeader
                eyebrow="Planned Features"
                title="What the IDE will offer"
                description="These are aspirational goals for the future AIRIS IDE. Nothing here is implemented yet."
              />
              <StaggerChildren staggerDelay={0.06} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {airisIdeFeatures.map((feat) => (
                  <StaggerItem key={feat}>
                    <Card className="glass-card hover-lift">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/20 bg-violet-400/10">
                            <Sparkles className="h-4 w-4 text-violet-400" />
                          </div>
                          <CardTitle className="text-sm font-medium">{feat}</CardTitle>
                        </div>
                      </CardHeader>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerChildren>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           DOCS / PROVIDERS
           ═══════════════════════════════════════════════════════ */}
        <section id="docs" aria-labelledby="docs-heading" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Documentation"
              title="Provider environment variables"
              description="Variables below are present in `airis --help` output. Set one before launching AIRIS."
            />
            <StaggerChildren staggerDelay={0.03} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map(([name, env]) => (
                <StaggerItem key={name}>
                  <div className="glass-card hover-lift rounded-xl border p-3 text-sm transition-colors">
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="font-medium">{name}</span>
                    </div>
                    <code className="mt-1 block break-all text-xs text-muted-foreground/70">{env}</code>
                  </div>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           PROJECT JOURNEY / CREATOR
           ═══════════════════════════════════════════════════════ */}
        <section id="creator" aria-labelledby="creator-heading" className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <ScrollReveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500/70" />
                Project Journey
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Built by a young developer
              </h2>
              <p className="mt-4 text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {repo.creatorProfile}
              </p>
            </ScrollReveal>

            <StaggerChildren staggerDelay={0.1} className="mt-10 grid gap-4 sm:grid-cols-3">
              <StaggerItem>
                <Card className="glass-card hover-lift">
                  <CardHeader className="items-center text-center">
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full border border-blue-400/20 bg-blue-400/10">
                      <span className="text-2xl font-bold text-blue-400">15</span>
                    </div>
                    <CardTitle>Started at 15</CardTitle>
                    <CardDescription>Umaiz began building AIRIS at age 15, driven by a vision for AI-powered developer tools.</CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="glass-card hover-lift">
                  <CardHeader className="items-center text-center">
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full border border-violet-400/20 bg-violet-400/10">
                      <span className="text-2xl font-bold text-violet-400">16</span>
                    </div>
                    <CardTitle>Continuing at 16</CardTitle>
                    <CardDescription>Now 16, Umaiz actively maintains and evolves AIRIS with regular releases and new capabilities.</CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="glass-card hover-lift">
                  <CardHeader className="items-center text-center">
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                      <span className="text-2xl font-bold text-emerald-400">K</span>
                    </div>
                    <CardTitle>Under KageOS</CardTitle>
                    <CardDescription>The project is built under KageOS — focused on CLI tooling, automation, and developer workflows.</CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            </StaggerChildren>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           SAFETY
           ═══════════════════════════════════════════════════════ */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionHeader
              eyebrow="Safety & Trust"
              title="Built with developer safety in mind"
              description="AIRIS runs locally with your user permissions. Trust controls and safety features help you work confidently."
            />
            <ScrollReveal variant="scale-in">
              <Card className="glass-card">
                <CardContent className="p-5 sm:p-6">
                  <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                      <span>README states AIRIS runs locally with your user permissions and does not sandbox itself.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                      <span>Project trust controls whether AIRIS can use project-local resources and mutation tools.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                      <span>
                        Do not paste{" "}
                        <code className="rounded bg-secondary px-1 font-mono text-xs">.env</code>{" "}
                        files, private keys, API tokens, or personal data into public issues or prompts.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                      <span>AI-generated code requires human review according to the repository README.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />

      {/* ── SCROLL TO TOP ── */}
      <ScrollToTop />
    </div>
  );
}
