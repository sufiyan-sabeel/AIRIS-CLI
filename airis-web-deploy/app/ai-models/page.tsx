import Link from "next/link";
import { ArrowRight, Bot, Check, Cloud, Cpu, ExternalLink, Zap } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";
import { Badge } from "@/components/ui/badge";

const providerCategories = [
  {
    title: "Cloud AI Providers",
    description: "Premium API-based AI models",
    icon: Cloud,
    providers: [
      { name: "OpenAI", models: "GPT-4o, GPT-4, GPT-3.5", key: "OPENAI_AAIRIS_KEY", tier: "Premium" },
      { name: "Anthropic", models: "Claude 3.5 Sonnet, Claude 3 Opus", key: "ANTHROPIC_AAIRIS_KEY", tier: "Premium" },
      { name: "Google Gemini", models: "Gemini 2.0 Pro, Gemini 2.0 Flash", key: "GEMINI_AAIRIS_KEY", tier: "Premium" },
      { name: "DeepSeek", models: "DeepSeek V3, DeepSeek R1", key: "DEEPSEEK_AAIRIS_KEY", tier: "Standard" },
      { name: "Mistral AI", models: "Mistral Large, Mistral Small", key: "MISTRAL_AAIRIS_KEY", tier: "Standard" },
      { name: "Groq", models: "Mixtral, Llama 3, Gemma", key: "GROQ_AAIRIS_KEY", tier: "Fast" },
    ],
  },
  {
    title: "Aggregator & Platform Providers",
    description: "Access multiple models through one API",
    icon: Bot,
    providers: [
      { name: "OpenRouter", models: "200+ models, unified API", key: "OPENROUTER_AAIRIS_KEY", tier: "Aggregator" },
      { name: "Together AI", models: "100+ open models", key: "TOGETHER_AAIRIS_KEY", tier: "Aggregator" },
      { name: "Fireworks AI", models: "Mixtral, Llama, DeepSeek", key: "FIREWORKS_AAIRIS_KEY", tier: "Aggregator" },
      { name: "Amazon Bedrock", models: "Claude, Llama, Mistral", key: "AWS credentials", tier: "Enterprise" },
      { name: "Azure OpenAI", models: "GPT-4, GPT-4o, DALL-E", key: "AZURE_OPENAI_AAIRIS_KEY", tier: "Enterprise" },
      { name: "Cloudflare Workers AI", models: "Llama, Mistral, Stable Diffusion", key: "CLOUDFLARE_AAIRIS_KEY", tier: "Edge" },
    ],
  },
  {
    title: "Local & Specialized",
    description: "Run models on your own hardware",
    icon: Cpu,
    providers: [
      { name: "Ollama", models: "Llama 3, Mistral, Gemma, Phi", key: "OLLAMA_AAIRIS_KEY", tier: "Local" },
      { name: "xAI", models: "Grok-1, Grok-2", key: "XAI_AAIRIS_KEY", tier: "Standard" },
      { name: "Cerebras", models: "CS-3 based models", key: "CEREBRAS_AAIRIS_KEY", tier: "Fast" },
      { name: "NVIDIA NIM", models: "Optimized inference microservices", key: "NVIDIA_AAIRIS_KEY", tier: "Enterprise" },
      { name: "Kimi", models: "Kimi for Coding", key: "KIMI_AAIRIS_KEY", tier: "Specialized" },
      { name: "MiniMax", models: "MiniMax-Text, MiniMax-VL", key: "MINIMAX_AAIRIS_KEY", tier: "Standard" },
    ],
  },
];

const tierColors: Record<string, string> = {
  Premium: "bg-purple-400/10 text-purple-300 border-purple-400/20",
  Standard: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  Fast: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  Aggregator: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  Enterprise: "bg-red-400/10 text-red-300 border-red-400/20",
  Edge: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  Local: "bg-green-400/10 text-green-300 border-green-400/20",
  Specialized: "bg-violet-400/10 text-violet-300 border-violet-400/20",
};

const features = [
  { icon: Bot, title: "Multi-Provider Switching", description: "Switch between providers mid-conversation" },
  { icon: Zap, title: "Smart Model Routing", description: "Auto-select best model for each task" },
  { icon: Cpu, title: "Local Model Support", description: "Run Ollama models locally" },
  { icon: Cloud, title: "Cloud & Hybrid", description: "Mix local and cloud models" },
  { icon: ExternalLink, title: "Custom Providers", description: "Add any OpenAI-compatible API" },
  { icon: Check, title: "Automatic Fallbacks", description: "Failover to backup providers" },
];

export default function AIModelsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute right-1/4 top-12 -z-10 h-72 w-72 rounded-full bg-purple-500/8 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              AI Provider Ecosystem
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Choose from <span className="gradient-text">20+ AI Providers</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              AIRIS supports the widest range of AI providers of any platform. From premium cloud APIs to local models,
              aggregators to specialized coding models — you always have the best tool for the job.
            </p>
          </div>
        </section>

        {/* Provider Categories */}
        {providerCategories.map((category) => (
          <section key={category.title} className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <SectionHeader
                eyebrow={category.title}
                title={category.description}
                description="Set your API key and start using any provider immediately."
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.providers.map((provider) => (
                  <ScrollReveal key={provider.name}>
                    <Card className="glass-card hover-lift shine-card">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                          <Badge className={`${tierColors[provider.tier] || ""} text-[10px]`}>
                            {provider.tier}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1 font-mono text-xs">{provider.models}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <code className="block rounded-lg bg-secondary p-2.5 font-mono text-xs text-muted-foreground break-all">
                          {provider.key}
                        </code>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* Features */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Model Features"
              title="Intelligent model management"
              description="AIRIS provides advanced model routing and provider management."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feat) => (
                <StaggerItem key={feat.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <feat.icon className="mb-1 h-5 w-5 text-blue-400" />
                      <CardTitle className="text-sm">{feat.title}</CardTitle>
                      <CardDescription>{feat.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to connect your AI providers?
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Set up your first provider in minutes. Start with a free API key.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/docs/providers">
                  Provider Docs <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
