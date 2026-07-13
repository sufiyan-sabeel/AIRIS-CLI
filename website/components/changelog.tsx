"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Sparkles, Bug, ArrowUp, Clock, Package, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ChangelogEntry {
  version: string;
  date: string;
  type: "release" | "beta" | "alpha";
  title: string;
  changes: Array<{
    type: "added" | "changed" | "fixed" | "removed";
    description: string;
  }>;
}

// Static changelog data - in production, fetch from API
const changelogData: ChangelogEntry[] = [
  {
    version: "0.79.8",
    date: "2026-07-13",
    type: "release",
    title: "Web Platform Launch",
    changes: [
      { type: "added", description: "Multi-page marketing website with 14+ landing pages" },
      { type: "added", description: "AI Operating System Dashboard with workspace management" },
      { type: "added", description: "AIRIS Web IDE with Monaco editor, chat, file tree, and terminal" },
      { type: "added", description: "PWA support for mobile installation" },
      { type: "added", description: "Self-update system with changelog tracking" },
      { type: "added", description: "Documentation portal with quick start, CLI ref, and provider guides" },
      { type: "changed", description: "Upgraded marketing design to Apple-level premium aesthetic" },
      { type: "changed", description: "Expanded AI provider support to 20+ providers" },
    ],
  },
  {
    version: "0.79.0",
    date: "2026-07-01",
    type: "release",
    title: "Agent System & Workflow Automation",
    changes: [
      { type: "added", description: "Multi-agent orchestration system" },
      { type: "added", description: "Visual workflow builder (alpha)" },
      { type: "added", description: "Agent memory persistence" },
      { type: "added", description: "Workflow templates library" },
      { type: "changed", description: "Improved session management performance" },
    ],
  },
  {
    version: "0.78.0",
    date: "2026-06-15",
    type: "release",
    title: "Mobile & Android Enhancements",
    changes: [
      { type: "added", description: "ADB device control integration" },
      { type: "added", description: "Termux API support for Android notifications, TTS, clipboard" },
      { type: "added", description: "Voice assistant mode" },
      { type: "fixed", description: "Termux file system path resolution" },
    ],
  },
  {
    version: "0.77.0",
    date: "2026-06-01",
    type: "release",
    title: "Provider Ecosystem Expansion",
    changes: [
      { type: "added", description: "DeepSeek V3 and R1 provider support" },
      { type: "added", description: "xAI Grok integration" },
      { type: "added", description: "Cerebras CS-3 support" },
      { type: "added", description: "NVIDIA NIM integration" },
    ],
  },
];

const changeTypeColors: Record<string, string> = {
  added: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  changed: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  fixed: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  removed: "bg-red-400/10 text-red-300 border-red-400/20",
};

const changeTypeIcons: Record<string, React.ElementType> = {
  added: Sparkles,
  changed: RefreshCw,
  fixed: Bug,
  removed: ArrowUp,
};

export function ChangelogView({ compact = false }: { compact?: boolean }) {
  const data = compact ? changelogData.slice(0, 1) : changelogData;

  return (
    <div className="space-y-6">
      {data.map((entry) => (
        <Card key={entry.version} className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400/10">
                  <Package className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">v{entry.version}</CardTitle>
                    <Badge className={entry.type === "release" ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" : "bg-amber-400/10 text-amber-300 border-amber-400/20"}>
                      {entry.type}
                    </Badge>
                  </div>
                  <CardDescription>{entry.title} — {entry.date}</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {entry.changes.map((change, idx) => {
                const Icon = changeTypeIcons[change.type];
                return (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${changeTypeColors[change.type]}`}>
                      {change.type}
                    </span>
                    <span className="text-muted-foreground">{change.description}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SelfUpdateNotification() {
  const [currentVersion] = useState("0.79.8");
  const [latestVersion] = useState("0.79.8");
  const [checking, setChecking] = useState(false);
  const updateAvailable = false; // In production, compare versions

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/update/check');
      if (res.ok) {
        const data = await res.json();
        console.log('Version check:', data);
      }
    } catch {
      // Offline, use cached version
    }
    setTimeout(() => setChecking(false), 1000);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-blue-400" />
          <div>
            <CardTitle className="text-sm">AIRIS v{currentVersion}</CardTitle>
            <CardDescription>
              {updateAvailable
                ? `Update available: v${latestVersion}`
                : "Up to date"}
            </CardDescription>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={checkForUpdates} disabled={checking}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
          Check
        </Button>
      </CardHeader>
    </Card>
  );
}
