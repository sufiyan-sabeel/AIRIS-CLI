import Link from "next/link";
import { ArrowRight, ExternalLink, GitFork, Github, KeyRound, Search, Terminal, Workflow } from "lucide-react";
import { AirisLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/code-block";
import { CommandExplorer } from "@/components/command-explorer";
import { TerminalDemo } from "@/components/terminal-demo";
import { docs, features, installSections, providers, repo, workflowPhases } from "@/data/site";

const nav = [
  ["Features", "#features"],
  ["Commands", "#commands"],
  ["Install", "#installation"],
  ["Docs", "#docs"],
];

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <Badge className="mb-4">{eyebrow}</Badge>
      <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">{title}</h2>
      <p className="mt-4 text-balance text-base leading-8 text-muted-foreground sm:text-lg">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="#top" aria-label="AIRIS CLI home"><AirisLogo /></Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary navigation">
            {nav.map(([label, href]) => <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="outline"><a href={repo.url} target="_blank" rel="noreferrer"><Github className="h-4 w-4" />GitHub</a></Button>
            <Button asChild size="sm" variant="outline"><a href={repo.forksUrl} target="_blank" rel="noreferrer"><GitFork className="h-4 w-4" />Forks</a></Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-border/70 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/2 top-0 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <AirisLogo large className="mb-8" />
              <Badge className="mb-5">{repo.fullName}</Badge>
              <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.07em] sm:text-6xl lg:text-7xl">
                A modern AI-powered command-line development assistant.
              </h1>
              <p className="mt-6 max-w-2xl text-balance text-lg leading-8 text-muted-foreground">
                AIRIS CLI is a local-first AI coding agent that runs in your terminal. It works with local files, shell commands, sessions, verified autonomy, and the `airis ship` workflow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><a href="#installation">Install AIRIS <ArrowRight className="h-4 w-4" /></a></Button>
                <Button asChild size="lg" variant="outline"><a href="#commands"><Search className="h-4 w-4" /> Explore commands</a></Button>
                <Button asChild size="lg" variant="ghost"><a href={repo.url} target="_blank" rel="noreferrer"><Github className="h-4 w-4" /> Repository</a></Button>
                <Button asChild size="lg" variant="ghost"><a href={repo.forksUrl} target="_blank" rel="noreferrer"><GitFork className="h-4 w-4" /> Fork project</a></Button>
              </div>
              <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div className="rounded-2xl border border-border bg-card p-4"><dt className="text-muted-foreground">Creator</dt><dd className="mt-1 font-medium">{repo.creator}</dd></div>
                <div className="rounded-2xl border border-border bg-card p-4"><dt className="text-muted-foreground">Brand</dt><dd className="mt-1 font-medium">{repo.organization}</dd></div>
                <div className="rounded-2xl border border-border bg-card p-4"><dt className="text-muted-foreground">Version</dt><dd className="mt-1 font-medium">{repo.version}</dd></div>
                <div className="rounded-2xl border border-border bg-card p-4"><dt className="text-muted-foreground">License</dt><dd className="mt-1 font-medium">{repo.license}</dd></div>
                <a className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary" href={repo.forksUrl} target="_blank" rel="noreferrer"><dt className="text-muted-foreground">GitHub</dt><dd className="mt-1 flex items-center gap-1 font-medium"><GitFork className="h-3.5 w-3.5" /> Forks</dd></a>
              </dl>
            </div>
            <TerminalDemo />
          </div>
        </section>

        <section id="features" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="Repository-verified" title="Capabilities exposed by the CLI" description="The feature list is limited to information verified from README, package metadata, source files, installation scripts, documentation, and `airis --help` output." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="bg-card/70">
                    <CardHeader>
                      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary"><Icon className="h-5 w-5 text-blue-500" /></div>
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                    <CardContent><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Evidence:</span> {feature.evidence}</p></CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="quick-start" className="border-y border-border/70 bg-secondary/35 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div>
              <Badge className="mb-4">Quick start</Badge>
              <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">Start from the terminal you already use.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">The README verifies interactive mode, one-shot prompt mode, and continuing the last session after setting a provider API key.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Card><CardHeader><KeyRound className="mb-2 h-5 w-5 text-blue-500" /><CardTitle>Provider key</CardTitle><CardDescription>Use a supported environment variable such as `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.</CardDescription></CardHeader></Card>
                <Card><CardHeader><Terminal className="mb-2 h-5 w-5 text-blue-500" /><CardTitle>CLI modes</CardTitle><CardDescription>Use interactive mode with `airis`, or one-shot prompt mode with `airis -p`.</CardDescription></CardHeader></Card>
              </div>
            </div>
            <CodeBlock code={'export GEMINI_API_KEY="your-key"\n# or: export OPENAI_API_KEY="your-key"\n# or: export ANTHROPIC_API_KEY="your-key"\n\nairis\nairis -p "List all TypeScript files in src/"\nairis --continue'} />
          </div>
        </section>

        <section id="commands" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionHeader eyebrow="Command explorer" title="Search verified commands" description="Commands, usage strings, and examples are taken from the repository help output and command handlers. Unsupported commands are omitted." />
            <CommandExplorer />
          </div>
        </section>

        <section id="installation" className="border-y border-border/70 bg-secondary/35 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="Installation" title="Install commands from the repository" description={`Runtime requirement verified from package metadata: Node.js ${repo.node}. These commands are copied from README, docs/installation.md, and install scripts.`} />
            <div className="grid gap-5 lg:grid-cols-2">
              {installSections.map((section) => (
                <Card key={section.platform}>
                  <CardHeader><CardTitle>{section.platform}</CardTitle><CardDescription>{section.platform === "Termux" ? "Supported by repository Termux instructions." : "Verified repository installation path."}</CardDescription></CardHeader>
                  <CardContent className="space-y-4">{section.commands.map((command) => <CodeBlock key={command} code={command} />)}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="airis ship" title="Full-lifecycle workflow" description="The README describes `airis ship` as a workflow that moves from request and contract through testing, verification, proof, and optional commit." />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {workflowPhases.map((phase, index) => (
                <Card key={phase} className="relative overflow-hidden">
                  <CardHeader>
                    <Badge className="w-fit">{String(index + 1).padStart(2, "0")}</Badge>
                    <CardTitle>{phase}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Card className="mt-8 overflow-hidden">
              <CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-blue-500" /> Architecture overview</CardTitle><CardDescription>Verified package structure: CLI entry point, coding agent, agent core, AI provider layer, TUI package, and local project/user state.</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm md:grid-cols-5">
                  {["airis CLI", "coding-agent", "agent core", "AI providers", "terminal UI"].map((node, index) => <div key={node} className="rounded-2xl border border-border bg-secondary p-4 text-center font-medium">{node}{index < 4 ? <span className="hidden md:block mt-3 text-muted-foreground">→</span> : null}</div>)}
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">State paths verified in README/help: user configuration under <code>~/.airis/agent</code>; project-local state under <code>.airis/</code>.</div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="docs" className="border-y border-border/70 bg-secondary/35 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Badge className="mb-4">Documentation</Badge>
              <nav className="grid gap-2" aria-label="Documentation navigation">
                {docs.map((item) => <a key={item.title} href={item.href} className="rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary">{item.title}</a>)}
              </nav>
            </aside>
            <div className="space-y-6">
              <Card><CardHeader><CardTitle>Docs search</CardTitle><CardDescription>Use the command explorer search for CLI reference. Browser search also works across this static documentation page.</CardDescription></CardHeader></Card>
              <Card><CardHeader><CardTitle>Provider environment variables</CardTitle><CardDescription>Variables below are present in `airis --help` output.</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{providers.map(([name, env]) => <div key={name} className="rounded-xl border border-border p-3 text-sm"><div className="font-medium">{name}</div><code className="text-xs text-muted-foreground">{env}</code></div>)}</div></CardContent></Card>
              <Card><CardHeader><CardTitle>Safety notes</CardTitle></CardHeader><CardContent className="prose-airis"><ul className="list-disc pl-5"><li>README states AIRIS runs locally with your user permissions and does not sandbox itself.</li><li>Project trust controls whether AIRIS can use project-local resources and mutation tools.</li><li>AI-generated code requires human review according to the repository README.</li></ul></CardContent></Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <div><AirisLogo /><p className="mt-3 max-w-xl text-sm text-muted-foreground">AIRIS CLI is created by {repo.creator} for {repo.organization}. Repository license: {repo.license}. Package: {repo.packageName}.</p></div>
          <div className="flex flex-wrap gap-3 text-sm"><a className="text-muted-foreground hover:text-foreground" href={repo.url} target="_blank" rel="noreferrer">Repository <ExternalLink className="inline h-3 w-3" /></a><a className="text-muted-foreground hover:text-foreground" href={repo.forksUrl} target="_blank" rel="noreferrer">Forks</a><a className="text-muted-foreground hover:text-foreground" href={`${repo.url}/blob/main/LICENSE`} target="_blank" rel="noreferrer">License</a><a className="text-muted-foreground hover:text-foreground" href={`${repo.url}/tree/main/docs`} target="_blank" rel="noreferrer">Documentation</a></div>
        </div>
      </footer>
    </div>
  );
}
