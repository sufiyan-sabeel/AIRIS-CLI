import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <section className="container flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Logo className="h-12 w-12 opacity-80" />
      <p className="mt-6 font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        This page wandered off
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The command you ran returned nothing. Let&apos;s get you back to a known
        state.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="gradient">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">Read the docs</Link>
        </Button>
      </div>
    </section>
  );
}
