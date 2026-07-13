"use client";

import { useState } from "react";
import { Bot, Play, StopCircle, Clock, BarChart3, Settings, Plus, Search, MoreHorizontal, Activity, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const agents = [
  { name: "Code Assistant", status: "running", type: "Development", tasks: 12, tokens: "45K", lastRun: "2 min ago" },
  { name: "Research Agent", status: "running", type: "Research", tasks: 8, tokens: "120K", lastRun: "1 min ago" },
  { name: "DevOps Agent", status: "idle", type: "Operations", tasks: 45, tokens: "200K", lastRun: "1 hour ago" },
  { name: "Testing Agent", status: "idle", type: "QA", tasks: 67, tokens: "89K", lastRun: "3 hours ago" },
  { name: "Data Analyst", status: "stopped", type: "Analytics", tasks: 23, tokens: "156K", lastRun: "Yesterday" },
];

const templates = [
  { name: "Code Reviewer", description: "Reviews pull requests and suggests improvements", type: "Development" },
  { name: "Content Writer", description: "Generates blog posts, docs, and social content", type: "Content" },
  { name: "Bug Hunter", description: "Scans code for bugs and security issues", type: "QA" },
  { name: "Data Pipeline", description: "Extracts, transforms, and loads data", type: "Data" },
];

export default function AgentsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your AI agents and their configurations.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      {/* Agent Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.name} className="glass-card hover-lift shine-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${
                    agent.status === "running" ? "bg-emerald-400/10" :
                    agent.status === "idle" ? "bg-amber-400/10" : "bg-muted"
                  }`}>
                    <Bot className={`h-5 w-5 ${
                      agent.status === "running" ? "text-emerald-400" :
                      agent.status === "idle" ? "text-amber-400" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{agent.name}</CardTitle>
                    <CardDescription>{agent.type}</CardDescription>
                  </div>
                </div>
                <Badge className={
                  agent.status === "running" ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" :
                  agent.status === "idle" ? "bg-amber-400/10 text-amber-300 border-amber-400/20" :
                  "bg-muted text-muted-foreground border-border/50"
                }>
                  {agent.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-medium text-foreground">{agent.tasks}</div>
                  <div className="text-muted-foreground">Tasks</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{agent.tokens}</div>
                  <div className="text-muted-foreground">Tokens</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{agent.lastRun}</div>
                  <div className="text-muted-foreground">Last Run</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {agent.status === "running" ? (
                  <Button size="sm" variant="outline" className="flex-1 gap-1">
                    <StopCircle className="h-3.5 w-3.5" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 gap-1">
                    <Play className="h-3.5 w-3.5" /> Start
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="px-2">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Templates */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Agent Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((tpl) => (
            <Card key={tpl.name} className="glass-card hover-lift cursor-pointer">
              <CardHeader>
                <Badge className="w-fit border-border/50 text-[10px]">{tpl.type}</Badge>
                <CardTitle className="mt-2 text-sm">{tpl.name}</CardTitle>
                <CardDescription>{tpl.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
