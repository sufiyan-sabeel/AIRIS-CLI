import { cn } from "@/lib/utils";
import BlurFade from "@/components/magicui/blur-fade";
import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  children,
}: PageHeaderProps) {
  return (
    <section className={cn("relative overflow-hidden border-b border-border/50 pb-12 pt-32 sm:pt-40", className)}>
      <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[34rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="container relative text-center">
        {eyebrow && (
          <BlurFade>
            <Badge variant="accent" className="gap-1.5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {eyebrow}
            </Badge>
          </BlurFade>
        )}
        <BlurFade delay={0.05}>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
        </BlurFade>
        {description && (
          <BlurFade delay={0.1}>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
              {description}
            </p>
          </BlurFade>
        )}
        {children && (
          <BlurFade delay={0.15}>
            <div className="mt-8 flex justify-center">{children}</div>
          </BlurFade>
        )}
      </div>
    </section>
  );
}
