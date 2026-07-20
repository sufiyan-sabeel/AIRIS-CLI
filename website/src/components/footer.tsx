import Link from "next/link";
import { Github, MessageCircle, Terminal } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import { siteConfig } from "@/lib/site";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features", external: false },
      { label: "Install", href: "/install", external: false },
      { label: "Documentation", href: "/docs", external: false },
      { label: "Roadmap", href: "/roadmap", external: false },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Providers", href: "/providers", external: false },
      { label: "Extensions", href: "/extensions", external: false },
      { label: "Blog", href: "/blog", external: false },
      { label: "Changelog", href: "/docs#changelog", external: false },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: siteConfig.repo, external: true },
      { label: "Discord", href: siteConfig.discord, external: true },
      { label: "Report issue", href: `${siteConfig.repo}/issues`, external: true },
      { label: "Contributing", href: `${siteConfig.repo}/blob/main/CONTRIBUTING.md`, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <LogoWordmark />
            <p className="max-w-xs text-sm text-muted-foreground">
              {siteConfig.fullName}. A terminal-native AI coding agent for
              everyone — from laptops to Android.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={siteConfig.repo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href={siteConfig.discord}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={siteConfig.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Install"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              >
                <Terminal className="h-4 w-4" />
                install
              </a>
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.brand}. AIRIS is{" "}
            <span className="text-foreground">{siteConfig.license}</span> licensed.
          </p>
          <p className="font-mono text-xs">
            v{siteConfig.version} · node {siteConfig.nodeVersion}
          </p>
        </div>
      </div>
    </footer>
  );
}
