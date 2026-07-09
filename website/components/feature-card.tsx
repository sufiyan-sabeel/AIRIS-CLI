import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeatureCard({
  icon: Icon,
  title,
  description,
  evidence,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  evidence: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "feature-card glass-card hover-lift group relative h-full overflow-hidden rounded-2xl border p-6",
        className
      )}
    >
      <div className="mb-4">
        <div className="feature-icon">
          <Icon className="h-5 w-5 text-blue-400" />
        </div>
      </div>
      <h3 className="mb-2 text-base font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 border-t border-border/40 pt-4">
        <p className="text-xs text-muted-foreground/60">
          <span className="font-medium text-muted-foreground/80">Source:</span> {evidence}
        </p>
      </div>
    </article>
  );
}
