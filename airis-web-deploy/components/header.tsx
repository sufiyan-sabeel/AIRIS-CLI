"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Github, ArrowRight, Menu } from "lucide-react";
import { AirisLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { label: "Features", href: "/features" },
  { label: "AI Models", href: "/ai-models" },
  { label: "Brain & Agents", href: "/brain" },
  { label: "Workflow", href: "/workflow" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

const dropdownItems = [
  { label: "Android Automation", href: "/android-automation" },
  { label: "Vision Studio", href: "/vision-studio" },
  { label: "Developer Tools", href: "/developer-tools" },
  { label: "Community", href: "/community" },
  { label: "Changelog", href: "/changelog" },
  { label: "Download", href: "/download" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Blog", href: "/blog" },
];

const allNavItems = [...mainNavItems, ...dropdownItems];

function NavLink({
  href,
  label,
  onClick,
  isActive,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-secondary text-foreground font-medium"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AIRIS home" className="shrink-0">
          <AirisLogo />
        </Link>

        {/* Desktop nav */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {mainNavItems.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild active={isActive(item.href)}>
                  <Link
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive(item.href)
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}

            {/* More Dropdown */}
            <NavigationMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    More
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {dropdownItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1 md:flex sm:gap-2">
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost">
            <a href="https://github.com/sufiyan-sabeel/AIRIS-CLI" target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="sm" className="hidden lg:inline-flex">
            <Link href="/download">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile: Sheet trigger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Toggle menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 pt-12">
              <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Mobile navigation">
                {allNavItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    isActive={isActive(item.href)}
                    onClick={() => setSheetOpen(false)}
                  />
                ))}
                <hr className="my-2 border-border/50" />
                <Link
                  href="/download"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "md" }),
                    "flex items-center justify-center gap-2"
                  )}
                  onClick={() => setSheetOpen(false)}
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
