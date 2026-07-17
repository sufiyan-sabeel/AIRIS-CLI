"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Zap,
  Database,
  Globe,
  TrendingUp,
  TrendingDown,
  Circle,
  Bot,
  Cpu,
  HardDrive,
  DollarSign,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

interface Metric {
  label: string;
  value: string;
  change: number;
  trend: "up" | "down" | "stable";
  icon: typeof Activity;
  color: string;
}

interface AgentEvent {
  id: number;
  agent: string;
  action: string;
  status: "running" | "success" | "error" | "pending";
  timestamp: string;
}

interface ProviderHealth {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency: number;
  color: string;
}

// ── Sample Data ──

const metrics: Metric[] = [
  { label: "Active Agents", value: "12", change: 23, trend: "up", icon: Bot, color: "#3b82f6" },
  { label: "Tokens Today", value: "1.2M", change: 8, trend: "up", icon: Zap, color: "#f59e0b" },
  { label: "Cache Hit Rate", value: "94%", change: 3, trend: "up", icon: HardDrive, color: "#10b981" },
  { label: "Avg Response", value: "320ms", change: 12, trend: "down", icon: Cpu, color: "#8b5cf6" },
];

const agentEvents: AgentEvent[] = [
  { id: 1, agent: "Code Assistant", action: "Reviewing PR #142", status: "running", timestamp: "now" },
  { id: 2, agent: "DevOps Agent", action: "Deploy staging → prod", status: "success", timestamp: "30s ago" },
  { id: 3, agent: "Research Agent", action: "Analyzing competitors", status: "running", timestamp: "2m ago" },
  { id: 4, agent: "Testing Agent", action: "Running E2E suite", status: "pending", timestamp: "5m ago" },
  { id: 5, agent: "Data Analyst", action: "Generating Q3 report", status: "success", timestamp: "10m ago" },
  { id: 6, agent: "Security Agent", action: "Scanning dependencies", status: "running", timestamp: "1m ago" },
  { id: 7, agent: "Automation Agent", action: "Syncing CRM data", status: "error", timestamp: "15m ago" },
  { id: 8, agent: "Content Agent", action: "Writing changelog", status: "success", timestamp: "20m ago" },
];

const providers: ProviderHealth[] = [
  { name: "Gemini", status: "healthy", latency: 145, color: "#3b82f6" },
  { name: "Anthropic", status: "healthy", latency: 230, color: "#8b5cf6" },
  { name: "OpenAI", status: "healthy", latency: 180, color: "#10b981" },
  { name: "DeepSeek", status: "degraded", latency: 890, color: "#f59e0b" },
  { name: "Ollama", status: "healthy", latency: 45, color: "#06b6d4" },
];

// ── Animated Bar Chart ──

function TokenUsageChart() {
  const prefersReduced = useReducedMotion();
  const [animated, setAnimated] = useState(false);

  const data = useMemo(() => [45, 52, 38, 65, 48, 72, 58, 82, 64, 78, 90, 85], []);
  const max = Math.max(...data, 1);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-end gap-[3px] h-20">
      {data.map((v, i) => {
        const height = `${(v / max) * 100}%`;
        return (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm"
            initial={prefersReduced ? false : { height: 0 }}
            animate={animated || prefersReduced ? { height } : { height: 0 }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: `linear-gradient(to top, rgba(59,130,246,0.3), rgba(59,130,246,0.6))`,
              opacity: prefersReduced ? 0.6 : 0.4 + (v / max) * 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Mini Sparkline (uses canvas for performance) ──

function Sparkline({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Fill gradient
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}20`);
    gradient.addColorStop(1, `${color}02`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data, color]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={24}
      className="shrink-0"
      aria-hidden="true"
    />
  );
}

// ── Animated Counter ──

function AnimatedValue({ value, duration = 1000 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState("0");
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const num = parseFloat(value);
    if (isNaN(num)) {
      setDisplay(value);
      return;
    }

    const isPercent = value.endsWith("%");
    const isK = value.endsWith("K") || value.endsWith("M");
    const steps = 30;
    const increment = num / steps;
    let current = 0;
    let i = 0;

    const timer = setInterval(() => {
      i++;
      current = Math.min(current + increment, num);
      const formatted = isPercent
        ? `${Math.round(current)}%`
        : isK
          ? `${current.toFixed(current >= 1 ? 1 : 2)}${value.slice(-1)}`
          : Math.round(current).toString();
      setDisplay(formatted);
      if (i >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, duration, prefersReduced]);

  return <span>{display}</span>;
}

// ── Metric Card ──

function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const prefersReduced = useReducedMotion();
  const Icon = metric.icon;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur-sm transition-all duration-300 hover:border-border/60 hover:shadow-lg sm:p-4 group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="grid h-9 w-9 place-items-center rounded-xl transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${metric.color}15` }}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.3 }}
          >
            <Icon className="h-4 w-4" style={{ color: metric.color }} />
          </motion.div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
            <p className="text-lg font-bold tracking-tight">
              <AnimatedValue value={metric.value} />
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div
            className={cn(
              "text-[11px] font-semibold",
              metric.trend === "up" && "text-emerald-400",
              metric.trend === "down" && "text-red-400",
              metric.trend === "stable" && "text-muted-foreground"
            )}
          >
            {metric.trend === "up" ? "+" : ""}
            {metric.change}%
          </div>
          {metric.trend === "up" ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : metric.trend === "down" ? (
            <TrendingDown className="h-3 w-3 text-red-400" />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// ── Agent Activity Timeline ──

function AgentActivity() {
  const prefersReduced = useReducedMotion();

  return (
    <div className="space-y-0.5">
      {agentEvents.slice(0, 6).map((event, i) => (
        <motion.div
          key={event.id}
          initial={prefersReduced ? false : { opacity: 0, x: -12 }}
          whileInView={prefersReduced ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-secondary/50 group"
        >
          <div className="relative shrink-0">
            <Circle
              className={cn(
                "h-2.5 w-2.5",
                event.status === "running" && "text-blue-400",
                event.status === "success" && "text-emerald-400",
                event.status === "error" && "text-red-400",
                event.status === "pending" && "text-muted-foreground"
              )}
              fill="currentColor"
            />
            {event.status === "running" && (
              <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-blue-400/30" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">{event.agent}</span>
            <span className="ml-2 text-muted-foreground">{event.action}</span>
          </div>
          <span className="shrink-0 text-muted-foreground/60 text-[10px]">{event.timestamp}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Provider Health ──

function ProviderHealthList() {
  const prefersReduced = useReducedMotion();

  return (
    <div className="space-y-2">
      {providers.map((p, i) => (
        <motion.div
          key={p.name}
          initial={prefersReduced ? false : { opacity: 0, x: -8 }}
          whileInView={prefersReduced ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Circle
                className="h-2.5 w-2.5"
                fill={
                  p.status === "healthy" ? "#10b981"
                  : p.status === "degraded" ? "#f59e0b"
                  : "#ef4444"
                }
                color={
                  p.status === "healthy" ? "#10b981"
                  : p.status === "degraded" ? "#f59e0b"
                  : "#ef4444"
                }
              />
              {p.status === "healthy" && (
                <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/30" />
              )}
            </div>
            <span className="font-medium text-foreground">{p.name}</span>
            {p.status === "degraded" && (
              <span className="rounded bg-amber-400/10 px-1 py-0.5 text-[9px] text-amber-300 font-medium">Degraded</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <motion.div
              className="h-1 w-16 overflow-hidden rounded-full bg-secondary"
              initial={false}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: p.latency < 200 ? "#10b981" : p.latency < 500 ? "#f59e0b" : "#ef4444" }}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, (p.latency / 1000) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </motion.div>
            <span className="font-mono text-muted-foreground w-12 text-right">{p.latency}ms</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Cache Analytics ──

function CacheAnalytics() {
  const prefersReduced = useReducedMotion();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const hitRate = 94;
  const missRate = 6;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-400 font-medium">Cache Hit: {hitRate}%</span>
        <span className="text-muted-foreground">Cache Miss: {missRate}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 bg-size-200 animate-shimmer"
          initial={prefersReduced ? { width: `${hitRate}%` } : { width: 0 }}
          animate={animated || prefersReduced ? { width: `${hitRate}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {[
          { label: "Memory Cache", value: "2.4 GB", sub: "of 4 GB", color: "#3b82f6" },
          { label: "Disk Cache", value: "8.1 GB", sub: "of 32 GB", color: "#8b5cf6" },
        ].map((item) => (
          <motion.div
            key={item.label}
            className="rounded-lg border border-border/30 p-2.5 transition-colors hover:border-border/50"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <p className="text-muted-foreground mb-0.5">{item.label}</p>
            <p className="font-semibold text-foreground">{item.value}</p>
            <p className="text-[10px] text-muted-foreground/60">{item.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──

export function DashboardPreview() {
  const prefersReduced = useReducedMotion();

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: -8 }}
        whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mb-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10">
            <BarChart3 className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <span className="text-sm font-semibold">Live Dashboard</span>
            <p className="text-[10px] text-muted-foreground">Real-time system metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <motion.div
            className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-1"
            animate={prefersReduced ? {} : { borderColor: ["rgba(16,185,129,0.2)", "rgba(16,185,129,0.4)", "rgba(16,185,129,0.2)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium text-emerald-300">Live</span>
          </motion.div>
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Updated now</span>
        </div>
      </motion.div>

      {/* Main dashboard */}
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/90 p-4 backdrop-blur-sm shadow-lg sm:p-6">
        {/* Metrics Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <MetricCard key={m.label} metric={m} index={i} />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {/* Token Usage Chart */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border/40 bg-card/50 p-4 transition-colors hover:border-border/60"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground">Token Usage (24h)</span>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-300">1.2M</span>
              </div>
            </div>
            <TokenUsageChart />
            <div className="mt-2 flex justify-between text-[9px] text-muted-foreground/50 font-mono">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>Now</span>
            </div>
          </motion.div>

          {/* Agent Activity */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border/40 bg-card/50 p-4 transition-colors hover:border-border/60"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Agent Activity</span>
              <div className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-300">12 active</span>
              </div>
            </div>
            <AgentActivity />
          </motion.div>

          {/* Provider Health & Cache */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Provider Health */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-4 transition-colors hover:border-border/60">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Provider Health</span>
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-mono text-emerald-300">4/5 healthy</span>
                </div>
              </div>
              <ProviderHealthList />
            </div>

            {/* Cache Analytics */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-4 transition-colors hover:border-border/60">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Cache Analytics</span>
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-mono">94% hit</span>
                </div>
              </div>
              <CacheAnalytics />
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-5 flex items-center justify-between border-t border-border/20 pt-4"
        >
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Est. cost today: $0.42
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Tools executed: 1,247
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground/30">Interactive preview</span>
        </motion.div>
      </div>
    </div>
  );
}
