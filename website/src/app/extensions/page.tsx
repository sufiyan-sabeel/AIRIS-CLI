import type { Metadata } from "next";
import { Github, Plug, Boxes, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CodeBlock } from "@/components/code-block";
import { CtaSection } from "@/components/cta-section";
import { Badge } from "@/components/ui/badge";
import BlurFade from "@/components/magicui/blur-fade";
import { extensions, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Extensions",
  description:
    "Extend AIRIS with TypeScript plugins, lifecycle hooks, custom tools, and Agent Skills. Explore the extension ecosystem and write your own.",
};

const statusVariant: Record<string, "default" | "accent" | "outline"> = {
  Stable: "default",
  Beta: "accent",
  Experimental: "outline",
};

const hooks = [
  "session start / end",
  "tool call intercept",
  "agent turn",
  "compaction customize",
  "slash command registration",
];

export default function ExtensionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Extensible"
        title="A small core, an open runtime"
        description="AIRIS stays minimal by design. Features that don't belong in core become extensions — TypeScript modules with lifecycle hooks, custom tools, and UI additions."
      >
        <a
          href={`${siteConfig.repo}/tree/main/.airis/extensions`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          <Github className="h-4 w-4" /> Browse the registry
        </a>
      </PageHeader>

      <section className="container py-16">
        <BlurFade>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/60 p-5 glass">
              <Plug className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">Custom tools</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Register tools the agent can call, with typed parameters.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5 glass">
              <Boxes className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-sm font-semibold">Lifecycle hooks</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Subscribe to session, tool, and turn events.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5 glass">
              <Wand2 className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">Slash commands</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Add <code className="font-mono">/your-command</code> to the TUI.
              </p>
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <h2 className="mb-4 text-xl font-semibold">Featured extensions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extensions.map((ext, i) => {
              const Icon = ext.icon;
              return (
                <BlurFade key={ext.name} delay={i * 0.03}>
                  <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card/60 p-5 glass">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-accent">
                        <Icon className="h-5 w-5" />
                      </span>
                      <Badge variant={statusVariant[ext.status]}>{ext.status}</Badge>
                    </div>
                    <h3 className="font-mono text-sm font-semibold">{ext.name}</h3>
                    <p className="flex-1 text-sm text-muted-foreground">
                      {ext.summary}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ext.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </BlurFade>
              );
            })}
          </div>
        </BlurFade>

        <BlurFade delay={0.1}>
          <div className="mt-16">
            <h2 className="mb-4 text-xl font-semibold">Write your first extension</h2>
            <CodeBlock
              filename="greet.ts"
              lang="typescript"
              code={`import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";
import { Type } from "typebox";

export default function (airis: ExtensionAPI) {
  airis.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(_id, params) {
      return {
        content: [{ type: "text", text: \`Hello, \${params.name}!\` }],
        details: {},
      };
    },
  });
}`}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Drop the file in{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">~/.airis/agent/extensions/</code>{" "}
              or load it with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">airis --extension ./greet.ts</code>. Hooks fire on: {hooks.join(", ")}.
            </p>
          </div>
        </BlurFade>
      </section>

      <CtaSection />
    </>
  );
}
