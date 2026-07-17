import Link from "next/link";
import { ArrowRight, Check, Cpu, Monitor, ExternalLink, Terminal } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { ScrollReveal } from "@/components/scroll-reveal";
import { InteractiveTerminal } from "@/components/interactive-terminal";

const requirements = [
  { icon: Cpu, label: "Node.js", value: ">= 22.19.0" },
  { icon: Monitor, label: "OS", value: "Linux, macOS, Windows, Android" },
  { icon: Terminal, label: "Terminal", value: "Bash, Zsh, Fish, PowerShell" },
  { icon: Cpu, label: "Architecture", value: "x64, ARM64, ARM" },
];

export default function DownloadPage() {
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
              Install AIRIS
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Install the{" "}
              <span className="gradient-text">AI Operating System</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Get started with AIRIS in minutes. Choose your preferred installation method below.
              Free and open source. No account required to install.
            </p>
          </div>
        </section>

        {/* Requirements */}
        <section className="px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {requirements.map((req) => (
                <div key={req.label} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur-sm">
                  <req.icon className="h-5 w-5 shrink-0 text-blue-400" />
                  <div>
                    <div className="text-xs text-muted-foreground">{req.label}</div>
                    <div className="text-sm font-medium">{req.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Install Methods */}
        <section className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal>
              <InteractiveTerminal />
            </ScrollReveal>
          </div>
        </section>

        {/* After Install */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <ScrollReveal variant="slide-left">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                  Next Steps
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  After installation
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Set up a provider API key and start using AIRIS. You can switch between providers anytime.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    "Set your API key environment variable",
                    "Run `airis doctor` to verify installation",
                    "Launch interactive mode with `airis`",
                    "Try one-shot: `airis -p \"Hello, AI!\"`",
                  ].map((step) => (
                    <div key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/docs/getting-started">
                      Quick Start Guide <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </ScrollReveal>
              <ScrollReveal variant="slide-right">
                <CodeBlock code={`# Set your API key (choose one provider)
export GEMINI_AAIRIS_KEY="your-gemini-key"
# or export OPENAI_AAIRIS_KEY="your-openai-key"
# or export ANTHROPIC_AAIRIS_KEY="your-anthropic-key"

# Verify installation
airis doctor

# Start using AIRIS
airis`} />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Web Platform */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl text-center">
            <Monitor className="mx-auto h-10 w-10 text-blue-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Try the web platform
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Prefer a browser-based experience? The AIRIS Web IDE runs entirely in your browser with PWA support for mobile.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/docs">
                Open Web Platform <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
