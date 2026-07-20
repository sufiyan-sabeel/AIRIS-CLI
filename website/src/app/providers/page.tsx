import type { Metadata } from "next";
import { Cloud, Cpu, Plug, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CodeBlock } from "@/components/code-block";
import { CtaSection } from "@/components/cta-section";
import BlurFade from "@/components/magicui/blur-fade";
import { providers } from "@/lib/site";

export const metadata: Metadata = {
  title: "Providers",
  description:
    "Connect AIRIS to 20+ AI providers and local models through one unified interface. Anthropic, OpenAI, Gemini, Bedrock, Ollama, and more.",
};

export default function ProvidersPage() {
  const cloud = providers.filter((p) => p.kind === "Cloud");
  const local = providers.filter((p) => p.kind === "Local");

  return (
    <>
      <PageHeader
        eyebrow="Providers"
        title="Bring your own model"
        description="AIRIS routes through one streaming interface across cloud providers and self-hosted models. Your keys stay local; your choice stays yours."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm glass">
            <Cloud className="h-4 w-4 text-primary" /> {cloud.length} cloud providers
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm glass">
            <Cpu className="h-4 w-4 text-accent" /> {local.length}+ local runtimes
          </span>
        </div>
      </PageHeader>

      <section className="container py-16">
        <BlurFade>
          <div className="mb-8 flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Cloud providers</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cloud.map((p, i) => (
              <BlurFade key={p.name} delay={i * 0.02}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card/60 p-4 glass">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <code className="rounded-md bg-[#0a0d16] px-2 py-1 font-mono text-[11px] text-accent">
                    {p.env}
                  </code>
                </div>
              </BlurFade>
            ))}
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <div className="mb-8 mt-14 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold">Local & self-hosted</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {local.map((p, i) => (
              <BlurFade key={p.name} delay={i * 0.03}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-4">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <code className="rounded-md bg-[#0a0d16] px-2 py-1 font-mono text-[11px] text-accent">
                    {p.env}
                  </code>
                </div>
              </BlurFade>
            ))}
          </div>
        </BlurFade>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <BlurFade>
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <KeyRound className="h-4 w-4 text-primary" /> Set a key
              </h3>
              <CodeBlock
                filename=".env"
                lang="bash"
                code={`# any one of these is enough to start
export GEMINI_AAIRIS_KEY="your-gemini-key"
export ANTHROPIC_AAIRIS_KEY="your-anthropic-key"
export OPENAI_AAIRIS_KEY="your-openai-key"

# then run
airis --provider gemini -p "hello"`}
              />
            </div>
          </BlurFade>
          <BlurFade delay={0.05}>
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Plug className="h-4 w-4 text-accent" /> Custom endpoints
              </h3>
              <CodeBlock
                filename="models.json"
                lang="json"
                code={`{
  "openai-completions": {
    "baseUrl": "http://localhost:1234/v1",
    "models": [
      {
        "id": "local-model",
        "name": "Local Model",
        "contextWindow": 32768,
        "maxTokens": 4096
      }
    ]
  }
}`}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Compatible with Ollama, LM Studio, vLLM, and any
                OpenAI-compatible endpoint. Extensions can add fully custom APIs
                and OAuth flows.
              </p>
            </div>
          </BlurFade>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
