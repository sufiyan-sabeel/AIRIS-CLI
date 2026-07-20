"use client";

import { cn } from "@/lib/utils";

interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  asChild?: boolean;
}

export const ShimmerButton = ({
  children,
  className,
  shimmerColor = "hsl(var(--accent))",
  shimmerSize = "0.1em",
  shimmerDuration = "2.5s",
  borderRadius = "0.75rem",
  background = "linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))",
  ...props
}: ShimmerButtonProps) => {
  return (
    <button
      style={{
        // @ts-expect-error css var
        "--shimmer-color": shimmerColor,
        "--shimmer-size": shimmerSize,
        "--shimmer-duration": shimmerDuration,
        "--border-radius": borderRadius,
        background,
      }}
      className={cn(
        "group relative inline-flex h-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl px-7 text-base font-medium text-primary-foreground [background-size:100%_100%] [box-shadow:0_0_30px_-6px_hsl(var(--accent)/0.6)] transition-[filter] hover:brightness-110",
        className
      )}
      {...props}
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(110deg, transparent 25%, var(--shimmer-color) 50%, transparent 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer var(--shimmer-duration) infinite linear",
          maskImage:
            "linear-gradient(to bottom, black 35%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 35%, transparent 100%)",
          opacity: 0.6,
        }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
};
