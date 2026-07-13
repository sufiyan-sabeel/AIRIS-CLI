import Link from "next/link";
import {
  MessageSquare,
  FolderKanban,
  Bot,
  Workflow,
  Eye,
  Code2,
  BarChart3,
  ArrowRight,
  Terminal,
  Activity,
  Zap,
  Clock,
  RefreshCw,
  Package,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelfUpdateNotification, ChangelogView } from "@/components/changelog";

const quickActions = [
  { icon: MessageSquare, label: "New Chat", href: "/app/workspace", color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: Bot, label: "Create Agent", href: "/app/agents", color: "text-purple-400", bg: "bg-purple-400/10" },
  { icon: Workflow, label: "New Workflow", href: "/app/workflows", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { icon: FolderKanban, label: "Open Project", href: "/app/projects", color: "text-amber-400", bg: "bg-amber-400/10" },
];

const recentActivity = [
  { action: "Chat session", detail: "Code review for auth.tsx", time: "2 min ago", type: "chat" },
  { action: "Workflow executed", detail: "Deploy pipeline completed", time: "15 min ago", type: "workflow" },
  { action: "Agent task", detail: "Research agent finished report", time: "1 hour ago", type: "agent" },
  { action: "Code generated", detail: "API endpoint created in main.ts", time: "3 hours ago", type: "code" },
];

const stats = [
  { label: "AI Conversations", value: "128", change: "+12 today", icon: MessageSquare },
  { label: "Active Agents", value: "5", change: "3 running", icon: Bot },
  { label: "Workflows", value: "23", change: "8 automated", icon: Workflow },
  { label: "Tokens Used", value: "1.2M", change: "~$2.40", icon: Zap },
];

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here&apos;s an overview of your AIRIS workspace.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="glass-card hover-lift">
                <CardHeader className="flex-row items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${action.bg}`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{action.label}</CardTitle>
                    <ArrowRight className="mt-0.5 h-3 w-3 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="mt-1 text-2xl">{stat.value}</CardTitle>
              </div>
              <stat.icon className="h-8 w-8 text-blue-400/30" />
            </CardHeader>
            <CardContent>
              <span className="text-xs text-emerald-400">{stat.change}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-blue-400" />
                Recent Activity
              </CardTitle>
              <Link href="/app/analytics" className="text-xs text-blue-400 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border border-border/40 bg-secondary/30 p-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full ${
                    item.type === "chat" ? "bg-blue-400" :
                    item.type === "workflow" ? "bg-emerald-400" :
                    item.type === "agent" ? "bg-purple-400" : "bg-amber-400"
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4 text-emerald-400" />
                System Status
              </CardTitle>
              <Badge className="bg-emerald-400/10 text-emerald-300 border-emerald-400/20 text-[10px]">
                All Systems Operational
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "AI Providers", status: "Connected", statusColor: "text-emerald-400" },
                { name: "API Server", status: "Running", statusColor: "text-emerald-400" },
                { name: "WebSocket", status: "Active", statusColor: "text-emerald-400" },
                { name: "File System", status: "Ready", statusColor: "text-emerald-400" },
                { name: "Agent Runtime", status: "Active", statusColor: "text-emerald-400" },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    {item.name}
                  </div>
                  <span className={`text-xs font-medium ${item.statusColor}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Self-Update & Changelog */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SelfUpdateNotification />
        <Link href="/changelog" className="block">
          <Card className="glass-card hover-lift shine-card h-full">
            <CardHeader className="flex-row items-center gap-3">
              <Package className="h-5 w-5 text-blue-400" />
              <div>
                <CardTitle className="text-sm">View Full Changelog</CardTitle>
                <CardDescription>See what&apos;s new in the latest release</CardDescription>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* AI Workspace Quick Chat */}
      <div className="mt-6">
        <Link href="/app/workspace">
          <Card className="glass-card hover-lift shine-card border-blue-400/20">
            <CardHeader className="flex-row items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-400/10">
                <MessageSquare className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Open AI Workspace</CardTitle>
                <CardDescription>Continue your conversation or start a new one</CardDescription>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
