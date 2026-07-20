import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CodeBlock } from "@/components/code-block";
import { CtaSection } from "@/components/cta-section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import BlurFade from "@/components/magicui/blur-fade";
import { cliCommands } from "@/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "AIRIS documentation: getting started, command reference, providers, ship workflow, configuration, themes, and troubleshooting.",
};

const nav = [
  { id: "getting-started", label: "Getting started" },
  { id: "commands", label: "Command reference" },
  { id: "providers", label: "AI providers" },
  { id: "ship", label: "Ship workflow" },
  { id: "configuration", label: "Configuration" },
  { id: "themes", label: "Themes" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "changelog", label: "Changelog" },
];

const faqs = [
  {
    q: "How are credentials resolved?",
    a: "In order: the --aairis-key flag, your local auth file, then environment variables, then custom provider keys from models.json. Use /login in interactive mode to store OAuth or API credentials safely.",
  },
  {
    q: "How do I keep AIRIS from editing files?",
    a: "Read-only tools (grep, find, ls) are off by default. Use --no-tools to disable all tools, or --tools read,grep,find,ls for a read-only run. Per-project trust is controlled with airis trust and --approve / --no-approve.",
  },
  {
    q: "Can I run AIRIS non-interactively in scripts?",
    a: "Yes. airis -p \"...\" processes a prompt and exits. Use --mode json or --mode rpc for machine-readable output, and --export to write a session as HTML.",
  },
  {
    q: "Where does AIRIS store state?",
    a: "Global config lives at ~/.airis/agent. Project-local state goes in .airis/ inside your repo. Session storage uses AIRIS_CODING_AGENT_SESSION_DIR or --session-dir.",
  },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Docs"
        title="Documentation"
        description="Task-first guides and a complete reference. Everything you need to install, configure, and extend AIRIS."
      />

      <div className="container grid gap-10 py-16 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="max-w-3xl space-y-16">
          <BlurFade>
            <section id="getting-started" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Getting started</h2>
              <p className="mt-3 text-muted-foreground">
                Install AIRIS, set a provider key, and run your first prompt.
              </p>
              <div className="mt-4 space-y-3">
                <CodeBlock
                  filename="1-install.sh"
                  lang="bash"
                  code={`curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash`}
                />
                <CodeBlock
                  filename="2-env.sh"
                  lang="bash"
                  code={`export GEMINI_AAIRIS_KEY="your-gemini-key"`}
                />
                <CodeBlock
                  filename="3-run.sh"
                  lang="bash"
                  code={`airis                 # interactive
airis -p "summarize this repo"   # one-shot
airis --continue      # resume last session`}
                />
              </div>
            </section>
          </BlurFade>

          <BlurFade>
            <section id="commands" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Command reference</h2>
              <p className="mt-3 text-muted-foreground">
                A selection of the most-used commands. Run{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">airis help</code>{" "}
                for the full list.
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Command</th>
                      <th className="px-4 py-2.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cliCommands.map((c) => (
                      <tr key={c.command} className="border-t border-border/60">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-accent">
                          {c.command}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {c.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </BlurFade>

          <BlurFade>
            <section id="providers" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">AI providers</h2>
              <p className="mt-3 text-muted-foreground">
                AIRIS speaks a unified streaming interface over 20+ providers and
                any OpenAI-compatible local model. Set a key and pick a model.
              </p>
              <CodeBlock
                filename="provider.sh"
                lang="bash"
                code={`airis --provider anthropic --model *sonnet* -p "refactor utils"
airis --provider ollama --model llama3 -p "local only"
airis --list-models gemini   # fuzzy search`}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Add custom endpoints (Ollama, LM Studio, vLLM) through{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">~/.airis/agent/models.json</code>.
              </p>
            </section>
          </BlurFade>

          <BlurFade>
            <section id="ship" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Ship workflow</h2>
              <p className="mt-3 text-muted-foreground">
                Turn a request into a tracked lifecycle: contract, plan,
                implement, verify, and produce a proof report.
              </p>
              <CodeBlock
                filename="ship.sh"
                lang="bash"
                code={`airis ship start "add authentication middleware"
airis ship status
airis ship resume
airis ship list`}
              />
            </section>
          </BlurFade>

          <BlurFade>
            <section id="configuration" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Configuration</h2>
              <p className="mt-3 text-muted-foreground">
                Project settings override global settings. Edit them directly or
                through the CLI.
              </p>
              <CodeBlock
                filename="config.sh"
                lang="bash"
                code={`airis config show            # sanitized view
airis config get theme
airis config set theme graphite
airis config path`}
              />
            </section>
          </BlurFade>

          <BlurFade>
            <section id="themes" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Themes</h2>
              <p className="mt-3 text-muted-foreground">
                The terminal UI uses a 51-token theme system. Built-ins include{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">graphite</code> and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">light</code>. Author your own JSON theme.
              </p>
              <CodeBlock
                filename="theme.sh"
                lang="bash"
                code={`airis theme list
airis theme set graphite
airis --theme ./my-theme.json`}
              />
            </section>
          </BlurFade>

          <BlurFade>
            <section id="troubleshooting" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Troubleshooting</h2>
              <div className="mt-4">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((f, i) => (
                    <AccordionItem key={i} value={`f-${i}`}>
                      <AccordionTrigger>{f.q}</AccordionTrigger>
                      <AccordionContent>{f.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          </BlurFade>

          <BlurFade>
            <section id="changelog" className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Changelog</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="font-mono text-accent">v0.79.8</span>
                  <span className="text-muted-foreground">
                    Stable TUI, project trust, sessions, and verified autonomy primitives.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-accent">v0.80</span>
                  <span className="text-muted-foreground">
                    In progress: doc doctor, ship workflow, adaptive brain, provider discovery.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-accent">v0.85</span>
                  <span className="text-muted-foreground">
                    Planned: model router, privacy firewall, repository intelligence.
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">airis changelog</code> to see the latest entry in your terminal.
              </p>
            </section>
          </BlurFade>
        </div>
      </div>

      <CtaSection />
    </>
  );
}
