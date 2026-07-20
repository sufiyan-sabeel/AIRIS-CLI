import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-7 w-7", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="airis-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(217 91% 60%)" />
          <stop offset="1" stopColor="hsl(187 92% 50%)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="url(#airis-mark)" strokeWidth="1.5" opacity="0.5" />
      <path
        d="M16 6 L25 25 H21 L16 14 L11 25 H7 Z"
        fill="url(#airis-mark)"
      />
      <circle cx="16" cy="20" r="1.6" fill="hsl(225 40% 4%)" />
      <path d="M16 6 V14" stroke="hsl(225 40% 4%)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Logo />
      <span className="text-lg">
        AIRIS
      </span>
    </span>
  );
}
