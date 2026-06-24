import {
  Terminal,
  FileCode,
  Cpu,
  Layers,
  Palette,
  Shield,
  Smartphone,
  GitBranch,
  Package,
  Zap,
  Search,
  Clock,
} from "lucide-react";

export interface Feature {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const features: Feature[] = [
  {
    title: "Interactive TUI",
    description:
      "Rich terminal user interface with split panels, syntax highlighting, and keyboard navigation.",
    icon: Terminal,
  },
  {
    title: "File Operations",
    description:
      "Read, edit, write, and search files with AI guidance and diff review before applying changes.",
    icon: FileCode,
  },
  {
    title: "Shell Execution",
    description:
      "Run bash commands with approval-based safety controls. AI suggests, you approve.",
    icon: Cpu,
  },
  {
    title: "Session Management",
    description:
      "Save, resume, fork, and export conversations to HTML. Never lose context.",
    icon: Clock,
  },
  {
    title: "25+ Providers",
    description:
      "OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Ollama, and more.",
    icon: Layers,
  },
  {
    title: "14+ Themes",
    description:
      "Professionally designed themes including Tokyo Night, Dracula, Gruvbox, and Catppuccin.",
    icon: Palette,
  },
  {
    title: "Project Trust",
    description:
      "Granular trust model. AIRIS asks before accessing project-local resources.",
    icon: Shield,
  },
  {
    title: "Android Ready",
    description:
      "Runs natively on Android through Termux. Full CLI functionality on mobile.",
    icon: Smartphone,
  },
  {
    title: "airis ship",
    description:
      "Full-lifecycle development workflow with TODO tracking, verification, and proof reports.",
    icon: GitBranch,
  },
  {
    title: "Extension System",
    description:
      "Custom extensions, skills, prompt templates, and tools with a full TypeScript SDK.",
    icon: Package,
  },
  {
    title: "Smart Routing",
    description:
      "Automatic tool selection based on task type. Use @coding, @automation prefixes.",
    icon: Zap,
  },
  {
    title: "Verified Autonomy",
    description:
      "Mission contracts with evidence-backed completion proofs for automated tasks.",
    icon: Search,
  },
];
