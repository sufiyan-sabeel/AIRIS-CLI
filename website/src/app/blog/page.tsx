import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import BlurFade from "@/components/magicui/blur-fade";
import { blogPosts } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Release notes, deep dives, and guides from the AIRIS team — verified autonomy, running on Termux, writing extensions, and more.",
};

export default function BlogPage() {
  const [featured, ...rest] = blogPosts;

  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title="Notes from the terminal"
        description="Releases, deep dives, and practical guides for getting the most out of AIRIS."
      />

      <section className="container py-16">
        <BlurFade>
          <Link
            href={`/blog/${featured.slug}`}
            className="group grid gap-6 overflow-hidden rounded-3xl border border-border bg-card/60 p-6 transition-all hover:border-primary/40 hover:shadow-[0_0_40px_-16px_hsl(var(--primary)/0.6)] glass sm:p-8 md:grid-cols-[1.1fr_1fr] md:items-center"
          >
            <div>
              <Badge variant="accent" className="mb-3">
                {featured.category}
              </Badge>
              <h2 className="text-2xl font-semibold tracking-tight transition-colors group-hover:text-primary">
                {featured.title}
              </h2>
              <p className="mt-3 text-muted-foreground">{featured.excerpt}</p>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{featured.date}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {featured.readingTime}
                </span>
              </div>
            </div>
            <div className="flex h-40 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 to-accent/10">
              <featured.icon className="h-14 w-14 text-accent/80" />
            </div>
          </Link>
        </BlurFade>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post, i) => (
            <BlurFade key={post.slug} delay={i * 0.04}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 glass"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{post.category}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="text-base font-semibold">{post.title}</h3>
                <p className="flex-1 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.date}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {post.readingTime}
                  </span>
                </div>
              </Link>
            </BlurFade>
          ))}
        </div>
      </section>
    </>
  );
}
