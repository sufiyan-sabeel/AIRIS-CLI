"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  ["Features", "#features"],
  ["Creator", "#creator"],
  ["Commands", "#commands"],
  ["Install", "#installation"],
  ["Docs", "#docs"],
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 px-0"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>
      {open && (
        <div className="fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-sm">
          <nav className="flex flex-col gap-1 p-6" aria-label="Mobile navigation">
            {nav.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-xl px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
