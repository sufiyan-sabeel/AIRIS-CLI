"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Bot,
  Cpu,
  Database,
  Puzzle,
  Globe,
  LayoutDashboard,
  Shield,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  label: string;
  description: string;
  details: string;
  icon: typeof Bot;
  color: string;
  x: number;
  y: number;
  connections: string[];
  dataFlow: string;
}

const nodes: Node[] = [
  {
    id: "agent",
    label: "Agent Core",
    description: "Multi-agent orchestration system with role-based autonomy and tool delegation.",
    details: "The central orchestrator that routes requests to specialized agents. Each agent has role-based autonomy, capability leasing, and evidence-backed verification.",
    icon: Bot,
    color: "#3b82f6",
    x: 50,
    y: 18,
    connections: ["memory", "tools", "learning"],
    dataFlow: "Request → Route → Execute → Verify",
  },
  {
    id: "memory",
    label: "Memory",
    description: "Episodic, semantic, and procedural memory persisting across sessions.",
    details: "Three-tier memory: episodic (session history), semantic (learned patterns), and procedural (workflow templates). Cache layer for fast retrieval.",
    icon: Database,
    color: "#8b5cf6",
    x: 15,
    y: 42,
    connections: ["agent", "audit", "dashboard"],
    dataFlow: "Store → Index → Retrieve → Cache",
  },
  {
    id: "tools",
    label: "Tools",
    description: "Built-in tool pipeline: read, write, edit, bash, grep, find, ls, and custom tools.",
    details: "Pipeline of built-in tools with trust controls. Extensible via custom tools. Supports file operations, shell execution, search, and project-aware workflows.",
    icon: Cpu,
    color: "#06b6d4",
    x: 85,
    y: 42,
    connections: ["agent", "extensions", "dashboard"],
    dataFlow: "Request → Validate → Execute → Report",
  },
  {
    id: "extensions",
    label: "Extensions",
    description: "Load extension files, skills, prompt templates, themes, and package sources.",
    details: "Plugin system for loading extensions, skill files, prompt templates, themes, and external package sources. Fully hot-reloadable.",
    icon: Puzzle,
    color: "#f59e0b",
    x: 72,
    y: 65,
    connections: ["tools", "providers"],
    dataFlow: "Load → Register → Validate → Enable",
  },
  {
    id: "providers",
    label: "Providers",
    description: "20+ AI providers: OpenAI, Anthropic, Gemini, DeepSeek, Ollama, and more.",
    details: "Unified interface for 20+ LLM providers with automatic failover, latency tracking, and cost management. Supports streaming and non-streaming modes.",
    icon: Globe,
    color: "#10b981",
    x: 28,
    y: 65,
    connections: ["extensions", "memory", "dashboard"],
    dataFlow: "Select → Auth → Query → Stream",
  },
  {
    id: "learning",
    label: "Project Learning",
    description: "Self-improvement through evidence-based learning and adaptive assessment.",
    details: "Analyzes project structure, learns conventions, captures patterns, and adapts behavior based on past outcomes. Self-improvement pipeline with reflection.",
    icon: Workflow,
    color: "#ec4899",
    x: 50,
    y: 38,
    connections: ["agent", "memory", "audit"],
    dataFlow: "Observe → Learn → Adapt → Improve",
  },
  {
    id: "audit",
    label: "Audit System",
    description: "Evidence-backed verification, failure genome records, and session auditing.",
    details: "Records every action with evidence. Failure genome captures error patterns. Full session audit trail for debugging and compliance.",
    icon: Shield,
    color: "#ef4444",
    x: 30,
    y: 85,
    connections: ["memory", "learning", "dashboard"],
    dataFlow: "Record → Verify → Analyze → Report",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Real-time agent activity, token usage, cache analytics, and provider health.",
    details: "Live monitoring dashboard with metrics on active agents, token consumption, cache analytics, provider health, tool execution, cost tracking, and memory activity.",
    icon: LayoutDashboard,
    color: "#14b8a6",
    x: 70,
    y: 85,
    connections: ["memory", "tools", "providers", "audit"],
    dataFlow: "Collect → Aggregate → Display → Alert",
  },
];

// ── Animated Data Flow Particles ──

function DataFlowParticles({ from, to, active }: { from: Node; to: Node; active: boolean }) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced || !active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;

    let particles: { x: number; y: number; progress: number; speed: number }[] = [];

    // Create particles along the line
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: from.x,
        y: from.y,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.008,
      });
    }

    let running = true;

    function animate() {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, w, h);

      particles = particles.map((p) => {
        const newProgress = p.progress + p.speed;
        if (newProgress > 1) {
          return { ...p, progress: 0 };
        }
        return { ...p, progress: newProgress };
      });

      particles.forEach((p) => {
        const x = from.x + (to.x - from.x) * p.progress;
        const y = from.y + (to.y - from.y) * p.progress;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.6 - p.progress * 0.3})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.15 - p.progress * 0.1})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [from, to, active, prefersReduced]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
      width={400}
      height={500}
    />
  );
}

// ── Architecture Node ──

function ArchitectureNode({
  node,
  isHovered,
  isConnected,
  onHover,
  onLeave,
}: {
  node: Node;
  isHovered: boolean;
  isConnected: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const Icon = node.icon;
  const prefersReduced = useReducedMotion();
  const highlight = isHovered || isConnected;

  return (
    <motion.div
      className="absolute z-20"
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
      initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
      whileInView={prefersReduced ? undefined : { scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.button
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn(
          "relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-2.5 transition-all duration-300 sm:px-5 sm:py-3.5",
          highlight
            ? "border-blue-400/50 bg-blue-500/15 shadow-xl shadow-blue-500/20"
            : "border-border/50 bg-card/80 backdrop-blur-sm hover:border-border/80"
        )}
        whileHover={prefersReduced ? {} : { scale: 1.1, y: -3 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Glow effect on hover */}
        {highlight && (
          <motion.div
            className="absolute -inset-1 rounded-2xl opacity-50 blur-md"
            style={{ backgroundColor: `${node.color}15` }}
            layoutId="nodeGlow"
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        )}

        <motion.div
          className="relative grid h-9 w-9 place-items-center rounded-xl sm:h-10 sm:w-10"
          style={{
            backgroundColor: `${node.color}20`,
            borderColor: `${node.color}40`,
            borderWidth: 1,
          }}
          animate={highlight ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: node.color }} />
        </motion.div>

        <span className="text-[10px] font-semibold text-foreground sm:text-xs">{node.label}</span>

        {/* Active indicator dot */}
        <motion.div
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background"
          style={{ backgroundColor: node.color }}
          animate={highlight ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Hover arrow */}
        {isHovered && (
          <motion.div
            className="absolute -bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b"
            style={{ borderColor: `${node.color}50`, backgroundColor: `${node.color}10` }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          />
        )}
      </motion.button>
    </motion.div>
  );
}

// ── Main Component ──

export function ArchitectureExplorer() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleHover = useCallback((id: string) => {
    setHoveredNode(id);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const activeNode = nodes.find((n) => n.id === hoveredNode);
  const connectedIds = activeNode ? activeNode.connections : [];

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Description panel */}
      <AnimatePresence mode="wait">
        {activeNode && (
          <motion.div
            key={activeNode.id}
            initial={prefersReduced ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm"
            style={{ borderColor: `${activeNode.color}30` }}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <motion.div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
                  style={{ backgroundColor: `${activeNode.color}15` }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <activeNode.icon className="h-6 w-6" style={{ color: activeNode.color }} />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-foreground sm:text-lg">
                      {activeNode.label}
                    </h4>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${activeNode.color}15`, color: activeNode.color }}
                    >
                      {activeNode.dataFlow}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeNode.details}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeNode.connections.map((connId) => {
                      const connNode = nodes.find((n) => n.id === connId);
                      if (!connNode) return null;
                      return (
                        <button
                          key={connId}
                          onClick={() => setHoveredNode(connId)}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-secondary"
                          style={{ borderColor: `${connNode.color}30`, color: connNode.color }}
                        >
                          <connNode.icon className="h-2.5 w-2.5" />
                          {connNode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map container */}
      <div
        className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm sm:h-[520px]"
        role="figure"
        aria-label="AIRIS Architecture Explorer — interactive system map"
      >
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Radial gradient highlight */}
        {activeNode && (
          <motion.div
            className="pointer-events-none absolute -z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              left: `${activeNode.x}%`,
              top: `${activeNode.y}%`,
              width: "300px",
              height: "300px",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${activeNode.color}08 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Connection lines (SVG) */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {nodes.map((from) =>
            from.connections.map((toId) => {
              const to = nodes.find((n) => n.id === toId);
              if (!to) return null;

              const isActive = hoveredNode === from.id || hoveredNode === toId || connectedIds.includes(from.id);
              const isBothConnected = hoveredNode && (from.id === hoveredNode || toId === hoveredNode || connectedIds.includes(from.id));

              return (
                <g key={`${from.id}-${toId}`}>
                  {/* Base line */}
                  <line
                    x1={`${from.x}%`}
                    y1={`${from.y}%`}
                    x2={`${to.x}%`}
                    y2={`${to.y}%`}
                    className="transition-all duration-700"
                    stroke={isActive ? from.color : "hsl(var(--border))"}
                    strokeWidth={isActive ? 2 : 0.5}
                    opacity={isActive ? 0.5 : 0.1}
                    style={isActive ? { filter: "url(#glow)" } : undefined}
                  />
                  {/* Active data flow highlight */}
                  {isBothConnected && (
                    <>
                      <line
                        x1={`${from.x}%`}
                        y1={`${from.y}%`}
                        x2={`${to.x}%`}
                        y2={`${to.y}%`}
                        className="transition-all duration-700"
                        stroke={from.color}
                        strokeWidth={3}
                        opacity={0.6}
                        strokeDasharray="6 4"
                        style={{ filter: "url(#glow)" }}
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="20"
                          dur="1s"
                          repeatCount="indefinite"
                        />
                      </line>
                    </>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {/* Data flow particles */}
        {activeNode &&
          activeNode.connections.map((toId) => {
            const to = nodes.find((n) => n.id === toId);
            if (!to) return null;
            return (
              <DataFlowParticles
                key={`part-${activeNode.id}-${toId}`}
                from={activeNode}
                to={to}
                active={true}
              />
            );
          })}

        {/* Nodes */}
        {nodes.map((node) => (
          <ArchitectureNode
            key={node.id}
            node={node}
            isHovered={hoveredNode === node.id}
            isConnected={connectedIds.includes(node.id)}
            onHover={() => handleHover(node.id)}
            onLeave={handleLeave}
          />
        ))}

        {/* Label */}
        <motion.div
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
          animate={{ opacity: hoveredNode ? 0 : 0.5 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-[10px] text-muted-foreground/50">
            Hover nodes to explore the AIRIS architecture
          </span>
        </motion.div>
      </div>
    </div>
  );
}
