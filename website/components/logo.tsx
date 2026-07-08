import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

function AirisMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect x="10" y="8" width="44" height="48" rx="14" className="fill-foreground" />
      <path d="M17 42.5C24.7 50.2 39.3 50.2 47 42.5" className="stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
      <path d="M19 22.5C25.3 14.2 38.7 14.2 45 22.5" className="stroke-background/90" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 43L31.9 18L44 43" className="stroke-background" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.7 34.6H38.4" className="stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 18V28.8" className="stroke-blue-300" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="18" r="3.4" className="fill-blue-500 stroke-background" strokeWidth="1.6" />
      <circle cx="19" cy="22.5" r="2.6" className="fill-blue-400" />
      <circle cx="45" cy="22.5" r="2.6" className="fill-blue-400" />
      <circle cx="47" cy="42.5" r="2.9" className="fill-blue-500 stroke-background" strokeWidth="1.3" />
    </svg>
  );
}

export function AirisLogo({ className, large = false, hideTagline = false }: { className?: string; large?: boolean; hideTagline?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} aria-label="AIRIS CLI">
      <AirisMark className={cn(large ? "h-11 w-11 sm:h-13 sm:w-13" : "h-7 w-7 sm:h-8 sm:w-8")} />
      <div>
        <div className={cn("font-semibold tracking-tight text-foreground", large ? "text-lg sm:text-xl" : "text-sm sm:text-base")}>
          AIRIS
          <span className="ml-1.5 font-normal text-muted-foreground">CLI</span>
        </div>
        {!hideTagline && (
          <div className={cn("text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 sm:text-[10px]", large ? "hidden sm:block" : "")}>
            {large ? "KageOS" : "KageOS"}
          </div>
        )}
      </div>
    </div>
  );
}
