"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, ArrowRight, ExternalLink, FileCode2, Layers3, BookOpen, Wrench, Plug, Smartphone, Terminal, Sparkles, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  external?: boolean;
  category: string;
}

const commands: CommandItem[] = [
  { id: "features", label: "Features", description: "Explore all AIRIS capabilities", href: "/features", icon: Sparkles, category: "Navigate" },
  { id: "install", label: "Install AIRIS", description: "Get started with one command", href: "/install", icon: Terminal, category: "Navigate" },
  { id: "docs", label: "Documentation", description: "Read the full documentation", href: "/docs", icon: BookOpen, category: "Navigate" },
  { id: "providers", label: "AI Providers", description: "Browse supported AI providers", href: "/providers", icon: Layers3, category: "Navigate" },
  { id: "extensions", label: "Extensions", description: "Explore the extension ecosystem", href: "/extensions", icon: Plug, category: "Navigate" },
  { id: "roadmap", label: "Roadmap", description: "See what's coming next", href: "/roadmap", icon: ScrollText, category: "Navigate" },
  { id: "blog", label: "Blog", description: "Read the latest updates", href: "/blog", icon: FileCode2, category: "Navigate" },
  { id: "github", label: "GitHub", description: "Star the repository", href: "https://github.com/sufiyan-sabeel/AIRIS-CLI", icon: Smartphone, external: true, category: "Links" },
  { id: "demo", label: "Live Demo", description: "Try AIRIS in your browser", href: "/#demo", icon: Command, category: "Navigate" },
  { id: "features-anchor", label: "Why AIRIS?", description: "See the comparison table", href: "/#why-airis", icon: Wrench, category: "Navigate" },
  { id: "cli-demo", label: "CLI Playground", description: "Interactive terminal demo", href: "/#cli-playground", icon: ArrowRight, category: "Navigate" },
  { id: "mobile", label: "Android & Termux", description: "Run AIRIS on mobile", href: "/install#termux", icon: Smartphone, category: "Links" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      handleClose();
      if (item.external) {
        window.open(item.href, "_blank", "noopener noreferrer");
      } else {
        router.push(item.href);
      }
    },
    [router, handleClose]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  };

  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search commands..."
                className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto scrollbar-thin p-2">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No results found
                </p>
              ) : (
                categories.map((cat) => (
                  <div key={cat}>
                    <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {cat}
                    </p>
                    {filtered
                      .filter((c) => c.category === cat)
                      .map((item, idx) => {
                        const globalIdx = filtered.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors",
                              selectedIndex === globalIdx
                                ? "bg-accent/15 text-accent"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="block truncate font-medium">
                                {item.label}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground/60">
                                {item.description}
                              </span>
                            </div>
                            {item.external ? (
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                            ) : (
                              <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:opacity-40 group-hover:translate-x-0" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground/50">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted/30 px-1 font-mono text-[10px]">↑↓</kbd>
                {" "}navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted/30 px-1 font-mono text-[10px]">↵</kbd>
                {" "}open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted/30 px-1 font-mono text-[10px]">Esc</kbd>
                {" "}close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
