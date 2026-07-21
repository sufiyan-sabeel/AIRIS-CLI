import Link from "next/link";
import { Github, ExternalLink, Heart } from "lucide-react";
import { AirisLogo } from "@/components/logo";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "AI Models", href: "/ai-models" },
      { label: "Brain & Agents", href: "/brain" },
      { label: "Workflow Automation", href: "/workflow" },
      { label: "Vision Studio", href: "/vision-studio" },
      { label: "Developer Tools", href: "/developer-tools" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Download & Install", href: "/download" },
      { label: "Android Automation", href: "/android-automation" },
      { label: "Documentation", href: "/docs" },
      { label: "Roadmap & Vision", href: "/roadmap" },
      { label: "Blog & Updates", href: "/blog" },
      { label: "API Reference", href: "/docs/api" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Community & Open Source", href: "/community" },
      { label: "GitHub", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI", external: true },
      { label: "Contributing", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/blob/main/CONTRIBUTING.md", external: true },
      { label: "Report Issue", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/issues", external: true },
      { label: "Discussions", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI/discussions", external: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Installation Guide", href: "/docs/getting-started" },
      { label: "CLI Reference", href: "/docs/cli" },
      { label: "Provider Setup", href: "/docs/providers" },
      { label: "Extension Development", href: "/docs/extensions" },
      { label: "SDK Documentation", href: "/docs/sdk" },
      { label: "Security", href: "/docs/security" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-[#0a0a0f]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <AirisLogo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Artificial Intelligence Responsive Integrated System — The next-generation AI Operating System for developers.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="https://github.com/sufiyan-sabeel/AIRIS-CLI"
                target="_blank"
                rel="noreferrer"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label} <ExternalLink className="h-3 w-3" />
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

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 text-center sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AIRIS CLI — Built with{" "}
            <Heart className="inline h-3 w-3 text-red-400" /> by Umaiz Sufiyan under KageOS. MIT License.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/docs/security" className="hover:text-foreground transition-colors">
              Security
            </Link>
            <Link href="/community" className="hover:text-foreground transition-colors">
              Community
            </Link>
            <Link href="/roadmap" className="hover:text-foreground transition-colors">
              Roadmap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
