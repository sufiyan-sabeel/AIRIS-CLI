"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Github, Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { AirisLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { label: "Features", href: "/features" },
  { label: "AI Models", href: "/ai-models" },
  { label: "Brain & Agents", href: "/brain" },
  { label: "Workflow", href: "/workflow" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

const dropdownItems = [
  { label: "Android Automation", href: "/android-automation" },
  { label: "Vision Studio", href: "/vision-studio" },
  { label: "Developer Tools", href: "/developer-tools" },
  { label: "Community", href: "/community" },
  { label: "Changelog", href: "/changelog" },
  { label: "Download", href: "/download" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Blog", href: "/blog" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass-nav">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AIRIS home" className="shrink-0">
          <AirisLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors",
                dropdownOpen
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              More <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border/50 bg-card/95 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl">
                {dropdownItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost" className="max-sm:hidden">
            <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI" target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="sm" className="hidden lg:inline-flex">
            <Link href="/download">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="space-y-1 px-4 py-4">
            {[...mainNavItems, ...dropdownItems].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <hr className="my-2 border-border/50" />
            <Link
              href="/download"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white"
              onClick={() => setMobileOpen(false)}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
