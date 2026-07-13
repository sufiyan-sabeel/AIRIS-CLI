import Link from "next/link";
import { ArrowRight, Terminal, KeyRound, Bot, ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/code-block";

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/docs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Docs
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quick Start Guide</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Get AIRIS running in 5 minutes. Choose your installation method and set up your first AI provider.
          </p>

          <div className="mt-10 space-y-8">
            {/* Step 1 */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-400">1</span>
                <h2 className="text-xl font-semibold">Install AIRIS</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Install via npm (recommended):</p>
              <div className="mt-2">
                <CodeBlock code="npm install -g @sufiyan-sabeel/airis-cli" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Or use the one-line installer:</p>
              <div className="mt-2">
                <CodeBlock code="curl -fsSL https://sufiyan-sabeel.github.io/AIRIS-CLI/install.sh | bash" />
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-400">2</span>
                <h2 className="text-xl font-semibold">Set an API Key</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Set at least one provider API key as an environment variable:</p>
              <div className="mt-2">
                <CodeBlock code={`export GEMINI_AAIRIS_KEY="your-gemini-key"
# or: export OPENAI_AAIRIS_KEY="your-openai-key"
# or: export ANTHROPIC_AAIRIS_KEY="your-anthropic-key"`} />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-400">3</span>
                <h2 className="text-xl font-semibold">Verify Installation</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Run the doctor command to verify everything is working:</p>
              <div className="mt-2">
                <CodeBlock code="airis doctor" />
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-400">4</span>
                <h2 className="text-xl font-semibold">Start Using AIRIS</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Launch interactive mode:</p>
              <div className="mt-2">
                <CodeBlock code="airis" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Or run a one-shot prompt:</p>
              <div className="mt-2">
                <CodeBlock code={'airis -p "List all TypeScript files in src/"'} />
              </div>
            </div>

            {/* Step 5: Web IDE */}
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-400">5</span>
                <h2 className="text-xl font-semibold">Try the Web IDE</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Prefer a browser-based experience? Open the AIRIS Web IDE:</p>
              <Button asChild className="mt-3">
                <Link href="/ide">
                  Open Web IDE <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
