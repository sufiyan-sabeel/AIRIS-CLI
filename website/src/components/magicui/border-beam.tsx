"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export const BorderBeam = ({
  className,
  size = 250,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "hsl(var(--primary))",
  colorTo = "hsl(var(--accent))",
  delay = 0,
}: BorderBeamProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className
      )}
      style={{
        // @ts-expect-error css var
        "--border-beam-size": size,
        "--border-beam-duration": `${duration}s`,
        "--border-beam-delay": `${delay}s`,
        "--border-beam-color-from": colorFrom,
        "--border-beam-color-to": colorTo,
        "--border-beam-border-width": `${borderWidth}px`,
      }}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: "var(--border-beam-border-width)",
          background: `conic-gradient(from var(--angle), transparent 0%, var(--border-beam-color-from) 10%, var(--border-beam-color-to) 30%, transparent 50%)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: "border-beam-spin var(--border-beam-duration) linear infinite",
        }}
      />
      <style>{`
        @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes border-beam-spin {
          to { --angle: 360deg; }
        }
      `}</style>
    </div>
  );
};
