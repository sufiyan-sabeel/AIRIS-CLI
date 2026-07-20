import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";
import { blogPosts } from "@/lib/site";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

const content: Record<string, React.ReactNode> = {
  "introducing-airis-0-80": (
    <>
      <p>
        The next milestone is about trust. AIRIS 0.80 focuses on the boring but
        essential work: a doc doctor that catches setup mistakes before they
        bite, a ship workflow you can actually rely on, and an adaptive brain
        that routes routine requests without burning tokens.
      </p>
      <p>
        Provider discovery is getting a polish pass so <code>--list-models</code>{" "}
        reflects what you can really call. Expect steadier TUI behavior across
        terminal widths and a cleaner permission story around mutation tools.
      </p>
      <CodeBlock
        filename="try.sh"
        lang="bash"
        code={`airis doctor            # self-diagnostics
airis ship start "task"  # full lifecycle
airis --list-models      # what's available`}
      />
    </>
  ),
  "verified-autonomy-explained": (
    <>
      <p>
        Autonomy scares people because it usually means giving up visibility.
        AIRIS takes the opposite stance: autonomous work is wrapped in a mission
        contract, scoped up front and approved by you.
      </p>
      <p>
        Once approved, a temporary lease grants exactly the capabilities the
        mission needs. When the work finishes, an evidence report shows what
        changed and why. A failure genome records what went wrong so the next
        run learns.
      </p>
      <CodeBlock
        filename="mission.sh"
        lang="bash"
        code={`airis mission "add tests" --verified
airis mission approve <id>
airis mission run <id>
airis evidence show <id>`}
      />
    </>
  ),
  "running-airis-on-termux": (
    <>
      <p>
        A phone is a perfectly good development machine if the tools fit. AIRIS
        runs inside Termux, and the adaptive UI shrinks to a compact layout on
        narrow terminals.
      </p>
      <p>
        Pair it with Termux:API for notifications and clipboard, or ADB
        automation to drive a real device from your agent session.
      </p>
      <CodeBlock
        filename="termux.sh"
        lang="bash"
        code={`pkg install nodejs git termux-api
npm install -g @sufiyan-sabeel/airis-cli
airis --help`}
      />
    </>
  ),
  "writing-your-first-extension": (
    <>
      <p>
        Extensions are plain TypeScript modules that receive an{" "}
        <code>ExtensionAPI</code>. Register a tool, hook into the agent loop, or
        add a slash command — no build step required for local use.
      </p>
      <p>
        Drop the file into your extensions directory or load it with{" "}
        <code>--extension</code>. The runtime discovers it, validates
        parameters with TypeBox, and exposes the tool to the model.
      </p>
      <CodeBlock
        filename="load.sh"
        lang="bash"
        code={`airis --extension ./greet.ts`}
      />
    </>
  ),
};

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const body = content[post.slug];

  return (
    <article className="container max-w-3xl py-32 sm:py-40">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to blog
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <Badge variant="accent">{post.category}</Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {post.readingTime}
        </span>
        <span className="text-xs text-muted-foreground">{post.date}</span>
      </div>

      <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {post.title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>

      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
        {body}
      </div>
    </article>
  );
}
