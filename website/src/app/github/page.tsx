import type { Metadata } from "next";
import { Github, GitBranch, ShieldCheck, Boxes, Workflow, Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import BlurFade from "@/components/magicui/blur-fade";
import { CodeBlock } from "@/components/code-block";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "GitHub",
  description:
    "AIRIS on GitHub: monorepo structure, CI/CD, security model, and how to contribute to an MIT-licensed terminal AI agent.",
};

const facts = [
  { icon: Star, label: "License", value: siteConfig.license },
  { icon: GitBranch, label: "Command", value: "airis" },
  { icon: Boxes, label: "Packages", value: "4 (cli, ai, agent, tui)" },
  { icon: Workflow, label: "CI", value: "11 workflows" },
];

const workflows = [
  "ci — lint, type-check, tests",
  "build-binaries — native releases",
  "deploy-pages — GitHub Pages",
  "npm-publish — version tags",
  "npm-audit — scheduled audit",
  "issue-gate / pr-gate — review gates",
];

export default function GitHubPage() {
  return (
    <>
      <PageHeader
        eyebrow="Open source"
        title="Built in the open"
        description="AIRIS is an MIT-licensed monorepo. Clone it, read it, extend it — and help shape what a terminal agent should be."
      >
        <Button asChild variant="gradient" size="lg">
          <a href={siteConfig.repo} target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4" />
            View repository
          </a>
        </Button>
      </PageHeader>

      <section className="container py-16">
        <div className="mx-auto grid max-w-4xl gap-10">
          <BlurFade>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.label}
                    className="rounded-xl border border-border bg-card/60 p-4 text-center glass"
                  >
                    <Icon className="mx-auto h-5 w-5 text-accent" />
                    <p className="mt-2 text-sm font-medium">{f.value}</p>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                  </div>
                );
              })}
            </div>
          </BlurFade>

          <BlurFade delay={0.05}>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="mb-3 text-lg font-semibold">Monorepo layout</h2>
                <CodeBlock
                  filename="AIRIS-CLI"
                  lang="text"
                  code={`packages/
  tui/          terminal UI library
  ai/           unified LLM API + providers
  agent/        agent core
  coding-agent/ CLI, tools, sessions
.airis/         skills, extensions, config
.github/workflows/   CI / CD
website/        this site`}
                />
              </div>
              <div>
                <h2 className="mb-3 text-lg font-semibold">CI / CD</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {workflows.map((w) => (
                    <li
                      key={w}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <code className="font-mono text-xs">{w}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={0.1}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
                <ShieldCheck className="h-6 w-6 text-accent" />
                <h3 className="mt-3 text-base font-semibold">Security model</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AIRIS runs with your user permissions — it is not a sandbox.
                  Treat project files as prompt-injection surfaces, review
                  generated changes, and report vulnerabilities privately to the
                  maintainers.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-6 glass">
                <GitBranch className="h-6 w-6 text-primary" />
                <h3 className="mt-3 text-base font-semibold">Contributing</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  New issues and PRs are gated by maintainer review. Read
                  CONTRIBUTING.md and AGENTS.md, keep core minimal, and run the
                  checks before opening a pull request.
                </p>
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={0.12}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="gradient">
                <a href={siteConfig.repo} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" /> Star the repo
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={siteConfig.discord} target="_blank" rel="noopener noreferrer">
                  Join the Discord
                </a>
              </Button>
            </div>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
