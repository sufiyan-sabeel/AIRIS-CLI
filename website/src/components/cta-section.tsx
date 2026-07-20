import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallCommand } from "@/components/install-command";
import { siteConfig } from "@/lib/site";

export function CtaSection() {
  return (
    <section className="container py-20">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-14 text-center shadow-2xl glass sm:px-12">
        <div className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-30" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Ship your first task with{" "}
            <span className="text-gradient">AIRIS</span> today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
            One line to install. No account required to try. Bring your own
            provider key and start coding with an agent that lives in your
            terminal.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <InstallCommand />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="lg">
              <Link href="/install">
                <Terminal className="h-4 w-4" />
                Install guide
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs">
                Read the docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            {siteConfig.license} licensed · v{siteConfig.version} · node{" "}
            {siteConfig.nodeVersion}
          </p>
        </div>
      </div>
    </section>
  );
}
