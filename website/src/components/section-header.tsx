import { cn } from "@/lib/utils";
import BlurFade from "@/components/magicui/blur-fade";
import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <BlurFade>
          <Badge variant="accent" className="gap-1.5 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {eyebrow}
          </Badge>
        </BlurFade>
      )}
      <BlurFade delay={0.05}>
        <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
      </BlurFade>
      {description && (
        <BlurFade delay={0.1}>
          <p
            className={cn(
              "max-w-2xl text-pretty text-muted-foreground sm:text-lg",
              align === "center" && "mx-auto"
            )}
          >
            {description}
          </p>
        </BlurFade>
      )}
    </div>
  );
}
