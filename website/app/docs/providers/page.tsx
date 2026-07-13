import Link from "next/link";
import { ArrowLeft, Bot, KeyRound, ExternalLink, Check, Copy } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const providerDocs = [
  {
    name: "Google Gemini",
    key: "GEMINI_AAIRIS_KEY",
    url: "https://ai.google.dev/",
    models: "Gemini 2.0 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro",
    setup: "Get your API key from Google AI Studio → Set as GEMINI_AAIRIS_KEY",
    tier: "Free tier available",
  },
  {
    name: "OpenAI",
    key: "OPENAI_AAIRIS_KEY",
    url: "https://platform.openai.com/",
    models: "GPT-4o, GPT-4, GPT-4 Turbo, GPT-3.5 Turbo",
    setup: "Create API key at OpenAI platform → Set as OPENAI_AAIRIS_KEY",
    tier: "Pay-as-you-go",
  },
  {
    name: "Anthropic",
    key: "ANTHROPIC_AAIRIS_KEY",
    url: "https://console.anthropic.com/",
    models: "Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku",
    setup: "Get API key from Anthropic Console → Set as ANTHROPIC_AAIRIS_KEY",
    tier: "Pay-as-you-go",
  },
  {
    name: "DeepSeek",
    key: "DEEPSEEK_AAIRIS_KEY",
    url: "https://platform.deepseek.com/",
    models: "DeepSeek V3, DeepSeek R1",
    setup: "Register at DeepSeek platform → Set as DEEPSEEK_AAIRIS_KEY",
    tier: "Affordable",
  },
  {
    name: "Mistral AI",
    key: "MISTRAL_AAIRIS_KEY",
    url: "https://console.mistral.ai/",
    models: "Mistral Large, Mistral Small, Codestral",
    setup: "Get API key from Mistral Console → Set as MISTRAL_AAIRIS_KEY",
    tier: "Free tier available",
  },
  {
    name: "Groq",
    key: "GROQ_AAIRIS_KEY",
    url: "https://console.groq.com/",
    models: "Mixtral, Llama 3, Gemma",
    setup: "Get API key from Groq Console → Set as GROQ_AAIRIS_KEY",
    tier: "Free tier (rate limited)",
  },
  {
    name: "OpenRouter",
    key: "OPENROUTER_AAIRIS_KEY",
    url: "https://openrouter.ai/",
    models: "200+ models via unified API",
    setup: "Get API key from OpenRouter → Set as OPENROUTER_AAIRIS_KEY",
    tier: "Pay-as-you-go",
  },
  {
    name: "Ollama (Local)",
    key: "OLLAMA_AAIRIS_KEY",
    url: "https://ollama.com/",
    models: "Llama 3, Mistral, Gemma, Phi, and more",
    setup: "Install Ollama → Run `ollama pull <model>` → Set OLLAMA_BASE_URL if needed",
    tier: "Free (local)",
  },
];

export default function ProvidersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Link href="/docs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Docs
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Provider Setup Guide</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Configure AI providers for AIRIS. You only need one provider to get started.
          </p>

          <div className="mt-10 space-y-4">
            {providerDocs.map((provider) => (
              <Card key={provider.name} className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400/10">
                        <Bot className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                        <CardDescription>{provider.models}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-blue-400/10 text-blue-300 border-blue-400/20 text-[10px]">{provider.tier}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Environment Variable</div>
                    <code className="block rounded-lg bg-secondary p-2.5 font-mono text-xs text-foreground">{provider.key}</code>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Setup</div>
                    <p className="text-sm text-muted-foreground">{provider.setup}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={provider.url} target="_blank" rel="noreferrer">
                      Get API Key <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-6">
            <KeyRound className="h-6 w-6 text-blue-400" />
            <h2 className="mt-3 text-lg font-semibold">Quick Setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set any provider key and run <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">airis</code> to start.
              AIRIS automatically detects configured providers.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
