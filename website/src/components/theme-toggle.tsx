"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const themes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground",
          className
        )}
        aria-label="Toggle theme"
      >
        <span className="h-4 w-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted",
          className
        )}
      >
        {isDark ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            {themes.map((t) => {
              const Icon = t.icon;
              const active =
                (t.value === "system" && resolvedTheme === "system") ||
                resolvedTheme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTheme(t.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                    active ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
