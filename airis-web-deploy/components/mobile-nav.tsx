"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Blocks,
  BookOpen,
  Download,
  Github,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const bottomTabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/features", label: "Features", icon: Blocks },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/download", label: "Get", icon: Download },
  {
    href: "https://github.com/sufiyan-sabeel/AIRIS-CLI",
    label: "GitHub",
    icon: Github,
    external: true,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("http")) return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/90 backdrop-blur-xl md:hidden"
        aria-label="Mobile bottom navigation"
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {bottomTabs.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return tab.external ? (
              <a
                key={tab.href}
                href={tab.href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </a>
            ) : (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors",
                  active
                    ? "text-blue-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind bottom nav */}
      <div className="h-16 md:hidden" aria-hidden="true" />

      {/* Full navigation sheet accessible from bottom nav */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 md:hidden"
            aria-label="Open navigation menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-8">
          <div className="px-4 py-3 text-center text-sm font-medium text-muted-foreground border-b border-border/50">
            Navigation
          </div>
          <nav className="grid gap-1 p-3" aria-label="Full mobile navigation">
            {[
              { href: "/", label: "Home" },
              { href: "/features", label: "Features" },
              { href: "/ai-models", label: "AI Models" },
              { href: "/brain", label: "Brain & Agents" },
              { href: "/workflow", label: "Workflow" },
              { href: "/pricing", label: "Pricing" },
              { href: "/docs", label: "Docs" },
              { href: "/android-automation", label: "Android Automation" },
              { href: "/vision-studio", label: "Vision Studio" },
              { href: "/developer-tools", label: "Developer Tools" },
              { href: "/community", label: "Community" },
              { href: "/changelog", label: "Changelog" },
              { href: "/download", label: "Download" },
              { href: "/roadmap", label: "Roadmap" },
              { href: "/blog", label: "Blog" },
              {
                href: "https://github.com/sufiyan-sabeel/AIRIS-CLI",
                label: "GitHub",
                external: true,
              },
            ].map((item) => {
              const active = isActive(item.href);
              return item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  onClick={() => setSheetOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <hr className="my-2 border-border/50" />
            <Link
              href="/download"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white"
              onClick={() => setSheetOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
