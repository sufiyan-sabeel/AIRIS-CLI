"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Bot,
  Workflow,
  Eye,
  Code2,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Search,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AirisLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
  { icon: MessageSquare, label: "AI Workspace", href: "/app/workspace" },
  { icon: FolderKanban, label: "Projects", href: "/app/projects" },
  { icon: Bot, label: "Agents", href: "/app/agents" },
  { icon: Workflow, label: "Workflows", href: "/app/workflows" },
  { icon: Eye, label: "Vision Studio", href: "/app/vision" },
  { icon: Code2, label: "Developer", href: "/app/developer" },
  { icon: BarChart3, label: "Analytics", href: "/app/analytics" },
];

const bottomItems = [
  { icon: Settings, label: "Settings", href: "/app/settings" },
  { icon: HelpCircle, label: "Help", href: "/app/help" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border/50 bg-[#0a0a0f] transition-all duration-300 lg:static",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-14 items-center border-b border-border/50 px-4", collapsed && "justify-center")}>
          {collapsed ? (
            <Terminal className="h-5 w-5 text-blue-400" />
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-semibold">AIRIS</span>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {sidebarItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  collapsed && "justify-center px-2",
                  active
                    ? "bg-blue-500/10 text-blue-400 font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border/50 p-3">
          {bottomItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 hidden w-full items-center justify-center rounded-lg px-2 py-2 text-muted-foreground transition-colors hover:bg-secondary lg:flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden"
              aria-label="Toggle sidebar"
            >
              <Terminal className="h-5 w-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-64 rounded-xl border border-border/50 bg-secondary/50 pl-9 pr-4 text-sm outline-none focus:border-blue-400/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
            </button>
            <ThemeToggle />
            <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm font-medium text-blue-400">
              U
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
