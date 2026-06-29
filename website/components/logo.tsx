import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

function AirisMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect x="10" y="8" width="44" height="48" rx="14" className="fill-foreground" />
      <path d="M17 42.5C24.7 50.2 39.3 50.2 47 42.5" className="stroke-blue-500" strokeWidth="4" strokeLinecap="round" />
      <path d="M19 22.5C25.3 14.2 38.7 14.2 45 22.5" className="stroke-background/90" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 43L31.9 18L44 43" className="stroke-background" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.7 34.6H38.4" className="stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 18V28.8" className="stroke-blue-300" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="18" r="3.4" className="fill-blue-500 stroke-background" strokeWidth="1.6" />
      <circle cx="19" cy="22.5" r="2.6" className="fill-blue-400" />
      <circle cx="45" cy="22.5" r="2.6" className="fill-blue-400" />
      <circle cx="47" cy="42.5" r="2.9" className="fill-violet-500 stroke-background" strokeWidth="1.3" />
    </svg>
  );
}

export function AirisLogo({ className, large = false }: { className?: string; large?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)} aria-label="AIRIS CLI">
      <AirisMark className={cn("drop-shadow-sm", large ? "h-16 w-16" : "h-10 w-10")} />
      <div>
        <div className={cn("font-semibold tracking-[-0.03em]", large ? "text-3xl" : "text-base")}>AIRIS CLI</div>
        {large ? <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">KageOS</div> : null}
      </div>
    </div>
  );
}
