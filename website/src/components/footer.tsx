import Link from "next/link";
import { MessageCircle, Terminal } from "lucide-react";
import AIRISLogo from "@/components/logo/AIRISLogo";
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <AIRISLogo size={32} animate={false} />
              <span className="text-lg font-semibold tracking-tight">AIRIS</span>
            </Link>
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
                <GitHubIcon className="h-4 w-4" />
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
