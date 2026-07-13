import Link from "next/link";
import { ArrowRight, Github, Heart, Users, BookOpen, Bug, GitPullRequest, MessageSquare, Sparkles, Star, ExternalLink, Globe, Twitter } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <Heart className="h-3 w-3 text-red-400" />
              <span>Open Source Community</span>
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Built in the open,{" "}
              <span className="gradient-text">by the community</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              AIRIS is free and open source software. We believe in building tools that anyone can use, modify, and contribute to.
              Join our growing community of developers, makers, and AI enthusiasts.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-border/50 px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              {[
                { value: "1,000+", label: "GitHub Stars" },
                { value: "50+", label: "Contributors" },
                { value: "20+", label: "AI Providers" },
                { value: "MIT", label: "License" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ways to Contribute */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ways to contribute</h2>
              <p className="mt-3 text-muted-foreground">Everyone can contribute, regardless of experience level.</p>
            </div>
            <StaggerChildren staggerDelay={0.06} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Code2, title: "Write Code", description: "Submit PRs for features, bug fixes, and improvements" },
                { icon: BookOpen, title: "Improve Docs", description: "Help make our documentation better for everyone" },
                { icon: Bug, title: "Report Bugs", description: "Found a bug? Open an issue on GitHub" },
                { icon: MessageSquare, title: "Join Discussions", description: "Share ideas and help other users in Discussions" },
                { icon: GitPullRequest, title: "Review PRs", description: "Help review pull requests from other contributors" },
                { icon: Sparkles, title: "Share Ideas", description: "Suggest features and improvements" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift shine-card h-full">
                    <CardHeader>
                      <item.icon className="h-6 w-6 text-blue-400" />
                      <CardTitle className="mt-2 text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* Community Links */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Connect with us</h2>
              <p className="mt-3 text-muted-foreground">Join the conversation across our community channels.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Github, title: "GitHub", description: "Source code, issues, PRs", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI", color: "text-white" },
                { icon: MessageSquare, title: "Discussions", description: "Q&A, ideas, show & tell", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/discussions", color: "text-blue-400" },
                { icon: Bug, title: "Issue Tracker", description: "Report bugs & feature requests", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/issues", color: "text-red-400" },
                { icon: GitPullRequest, title: "Pull Requests", description: "Submit your contributions", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/pulls", color: "text-emerald-400" },
              ].map((item) => (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className={`h-6 w-6 ${item.color}`} />
                      <CardTitle className="mt-2 text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Open Source Promise */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Heart className="mx-auto h-10 w-10 text-red-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Our commitment</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              AIRIS will always have a free and open source core. We are committed to building in public,
              with transparency, and with respect for our users&apos; privacy and data.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-amber-400" /> Star on GitHub
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitPullRequest className="h-4 w-4 text-emerald-400" /> Contribute
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 text-blue-400" /> Share
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Code2({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
