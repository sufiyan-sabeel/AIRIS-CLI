"use client";

import { useRef, createContext, useContext } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  SVG icons for each tab (no emojis)                                */
/* ------------------------------------------------------------------ */

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FeaturesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function InstallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Dock context & types                                              */
/* ------------------------------------------------------------------ */

const DockContext = createContext<{
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
} | null>(null);

const MAGNIFICATION = 52;
const DISTANCE = 120;
const BASE_SIZE = 42;
const ICON_SIZE = 20;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

/* ------------------------------------------------------------------ */
/*  DockItem                                                          */
/* ------------------------------------------------------------------ */

function DockItem({
  href,
  label,
  icon: Icon,
  external,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useContext(DockContext);
  const pathname = usePathname();
  if (!ctx) throw new Error("DockItem must be used within Dock");

  const { mouseX, magnification, distance } = ctx;
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const distCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const containerSize = useSpring(
    useTransform(distCalc, [-distance, 0, distance], [BASE_SIZE, magnification, BASE_SIZE]),
    SPRING
  );
  const iconSize = useSpring(
    useTransform(distCalc, [-distance, 0, distance], [ICON_SIZE, magnification * 0.5, ICON_SIZE]),
    SPRING
  );

  const linkProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <div ref={ref} className="relative">
      <Link href={href} {...linkProps}>
        <motion.div
          style={{ width: containerSize, height: containerSize }}
          className={cn(
            "relative flex items-center justify-center rounded-full transition-colors",
            isActive
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-muted/60 text-muted-foreground border border-border hover:text-foreground hover:bg-muted"
          )}
        >
          <motion.div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center">
            <Icon className="h-full w-full" />
          </motion.div>
        </motion.div>
      </Link>
      {/* Tooltip */}
      <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/dock:opacity-100 transition-opacity">
        <span className="whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dock                                                              */
/* ------------------------------------------------------------------ */

const tabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/features", label: "Features", icon: FeaturesIcon },
  { href: "/docs", label: "Documentation", icon: DocsIcon },
  { href: "/install", label: "Install", icon: InstallIcon },
  { href: "https://github.com/sufiyan-sabeel/AIRIS-CLI", label: "GitHub", icon: GitHubIcon, external: true },
];

export default function Dock() {
  const mouseX = useMotionValue(Infinity);

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 pointer-events-none">
      <DockContext.Provider
        value={{ mouseX, magnification: MAGNIFICATION, distance: DISTANCE }}
      >
        <motion.div
          onMouseMove={(e) => mouseX.set(e.pageX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className="pointer-events-auto mx-auto w-max h-14 px-2 flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/30"
        >
          {tabs.map((tab) => (
            <DockItem
              key={tab.href}
              href={tab.href}
              label={tab.label}
              icon={tab.icon}
              external={tab.external}
            />
          ))}
        </motion.div>
      </DockContext.Provider>
    </div>
  );
}
