import Link from "next/link";
import { ArrowRight, Calendar, Clock, ArrowLeft, Tag, User } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";

const posts = [
  {
    title: "Introducing AIRIS: The AI Operating System for Developers",
    excerpt: "Today we're announcing AIRIS — a next-generation AI Operating System that combines the power of ChatGPT, Cursor, GitHub, and workflow automation into one unified platform.",
    date: "2026-07-13",
    readTime: "5 min read",
    author: "Umaiz Sufiyan",
    tags: ["Announcement", "Product", "Release"],
    slug: "introducing-airis",
  },
  {
    title: "AIRIS Web IDE: Code with AI from Any Browser",
    excerpt: "We're launching the AIRIS Web IDE — a full-featured code editor with AI assistance that runs in any browser, with PWA support for mobile.",
    date: "2026-07-10",
    readTime: "4 min read",
    author: "Umaiz Sufiyan",
    tags: ["Web IDE", "Product", "Mobile"],
    slug: "airis-web-ide",
  },
  {
    title: "Multi-Agent Orchestration: How AIRIS Brain Works",
    excerpt: "Deep dive into the AIRIS Brain architecture — how our multi-agent orchestration system coordinates intelligent agents for complex tasks.",
    date: "2026-07-05",
    readTime: "7 min read",
    author: "Umaiz Sufiyan",
    tags: ["Agents", "Architecture", "AI"],
    slug: "multi-agent-orchestration",
  },
  {
    title: "Android Automation with AIRIS: ADB + AI",
    excerpt: "Learn how to control Android devices using AIRIS's ADB integration combined with AI vision and natural language commands.",
    date: "2026-06-28",
    readTime: "6 min read",
    author: "Umaiz Sufiyan",
    tags: ["Android", "Automation", "Tutorial"],
    slug: "android-automation-adb",
  },
  {
    title: "20+ AI Providers: Why Choice Matters",
    excerpt: "AIRIS supports more AI providers than any other platform. Here's why multi-provider access is essential for developers.",
    date: "2026-06-20",
    readTime: "4 min read",
    author: "Umaiz Sufiyan",
    tags: ["AI Providers", "Analysis", "Comparison"],
    slug: "20-ai-providers",
  },
  {
    title: "Building AIRIS: A 16-Year-Old's Journey",
    excerpt: "The story behind AIRIS — how a 16-year-old developer built an AI operating system from scratch, and what I learned along the way.",
    date: "2026-06-15",
    readTime: "8 min read",
    author: "Umaiz Sufiyan",
    tags: ["Story", "Development", "Open Source"],
    slug: "building-airis-journey",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Blog &{" "}
              <span className="gradient-text">Updates</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Latest news, product updates, tutorials, and stories from the AIRIS team.
            </p>
          </div>
        </section>

        {/* Featured Post */}
        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link href={`/blog/${posts[0].slug}`}>
              <Card className="glass-card hover-lift shine-card relative overflow-hidden">
                <div className="absolute right-0 top-0 h-32 w-32 bg-blue-500/10 blur-3xl" />
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge className="bg-blue-400/10 text-blue-300 border-blue-400/20">{posts[0].tags[0]}</Badge>
                    <span>{posts[0].date}</span>
                    <span>·</span>
                    <span>{posts[0].readTime}</span>
                  </div>
                  <CardTitle className="mt-3 text-2xl sm:text-3xl">{posts[0].title}</CardTitle>
                  <CardDescription className="mt-2 text-base">{posts[0].excerpt}</CardDescription>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {posts[0].author}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>

        {/* Post Grid */}
        <section className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(1).map((post) => (
                <ScrollReveal key={post.slug}>
                  <Link href={`/blog/${post.slug}`}>
                    <Card className="glass-card hover-lift shine-card h-full">
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {post.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} className="border-border/50 text-[10px]">{tag}</Badge>
                          ))}
                        </div>
                        <CardTitle className="mt-2 text-base">{post.title}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-3">{post.excerpt}</CardDescription>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                          </span>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Subscribe */}
        <section className="border-t border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Stay updated
            </h2>
            <p className="mt-3 text-muted-foreground">
              Get notified about new releases, features, and tutorials.
            </p>
            <div className="mx-auto mt-8 flex max-w-md gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 text-sm outline-none focus:border-blue-400/50"
              />
              <Button>Subscribe</Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
