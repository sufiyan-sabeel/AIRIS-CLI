"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Menu, X, FileCode2, Folder, FolderOpen, File,
  Terminal as TerminalIcon, MessageSquare, Send, Bot, User,
  Plus, Search, GitBranch, Settings, Play, PanelLeft, PanelBottom,
  ChevronDown, Zap, Circle, RefreshCw, Code2, Sparkles,
  FilePlus, FolderPlus, Download,
  Upload, GitCommit, GitPullRequest, GitFork, Github,
  Bug, PlayCircle,
  ChevronRight, RotateCcw,
  Trash2, Edit3, MoreHorizontal, Info, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
  content?: string;
}

interface Tab {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  dirty: boolean;
  savedContent: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  codeBlocks?: { language: string; code: string; filePath?: string }[];
  timestamp: Date;
}

interface ScaffoldTemplate {
  name: string;
  description: string;
  icon: string;
  files: { path: string; content: string }[];
}

interface GitStatus {
  branch: string;
  changes: number;
  staged: number;
  commits: number;
  remote?: string;
}

interface Breakpoint {
  file: string;
  line: number;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════

const sampleFiles: FileNode[] = [
  { name: "src", type: "folder", children: [
    { name: "components", type: "folder", children: [
      { name: "Header.tsx", type: "file", language: "typescript", content: '// Header.tsx\nexport function Header() {\n  return (\n    <header className="bg-gray-900 p-4">\n      <nav className="flex items-center justify-between max-w-7xl mx-auto">\n        <h1 className="text-xl font-bold">AIRIS App</h1>\n        <div className="flex gap-4">\n          <a href="/">Home</a>\n          <a href="/about">About</a>\n        </div>\n      </nav>\n    </header>\n  );\n}\n' },
      { name: "Sidebar.tsx", type: "file", language: "typescript", content: '// Sidebar.tsx\nexport function Sidebar({ items }: { items: string[] }) {\n  return (\n    <aside className="w-64 bg-gray-800 p-4">\n      <ul className="space-y-2">\n        {items.map((item) => (\n          <li key={item} className="cursor-pointer rounded p-2 hover:bg-gray-700">\n            {item}\n          </li>\n        ))}\n      </ul>\n    </aside>\n  );\n}\n' },
      { name: "Editor.tsx", type: "file", language: "typescript", content: "// Editor.tsx - main editor\nimport { useState, useCallback } from 'react';\n\nexport function Editor() {\n  const [code, setCode] = useState('// Start coding...');\n  const [language, setLanguage] = useState('typescript');\n  \n  return (\n    <div className=\"flex flex-col h-full\">\n      <div className=\"flex items-center gap-2 border-b p-2\">\n        <select \n          value={language}\n          onChange={(e) => setLanguage(e.target.value)}\n          className=\"rounded bg-gray-800 px-2 py-1 text-sm\"\n        >\n          <option>typescript</option>\n          <option>javascript</option>\n          <option>css</option>\n          <option>html</option>\n        </select>\n      </div>\n      <textarea\n        value={code}\n        onChange={(e) => setCode(e.target.value)}\n        className=\"flex-1 bg-transparent p-4 font-mono outline-none\"\n        spellCheck={false}\n      />\n    </div>\n  );\n}\n" },
    ]},
    { name: "pages", type: "folder", children: [
      { name: "index.tsx", type: "file", language: "typescript", content: '// pages/index.tsx\nexport default function Home() {\n  return (\n    <main className="min-h-screen bg-gray-900 text-white p-8">\n      <h1 className="text-4xl font-bold">Welcome to AIRIS</h1>\n      <p className="mt-4 text-gray-400">\n        Your AI-powered development environment\n      </p>\n    </main>\n  );\n}\n' },
      { name: "about.tsx", type: "file", language: "typescript", content: '// pages/about.tsx\nexport default function About() {\n  return (\n    <main className="min-h-screen bg-gray-900 text-white p-8">\n      <h1 className="text-4xl font-bold">About AIRIS</h1>\n      <p className="mt-4 text-gray-400">\n        Artificial Intelligence Responsive Integrated System\n      </p>\n    </main>\n  );\n}\n' },
    ]},
    { name: "App.tsx", type: "file", language: "typescript", content: "// App.tsx - Root application component\nimport { Header } from './components/Header';\nimport { Editor } from './components/Editor';\n\nexport default function App() {\n  return (\n    <div className=\"min-h-screen bg-gray-900 text-white\">\n      <Header />\n      <main className=\"flex\">\n        <Editor />\n      </main>\n    </div>\n  );\n}\n" },
    { name: "main.tsx", type: "file", language: "typescript", content: "// main.tsx - Application entry point\nimport React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n" },
    { name: "index.css", type: "file", language: "css", content: "/* index.css */\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: 'Inter', system-ui, sans-serif;\n}\n\n/* Custom scrollbar */\n::-webkit-scrollbar { width: 6px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }\n" },
  ]},
  { name: "public", type: "folder", children: [
    { name: "index.html", type: "file", language: "html", content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>AIRIS App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n' },
    { name: "vite.svg", type: "file", language: "xml", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2L2 28h28L16 2z" fill="#646cff"/></svg>' },
  ]},
  { name: "package.json", type: "file", language: "json", content: JSON.stringify({ name: "airis-project", version: "1.0.0", private: true, type: "module", scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" }, dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: { "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.6.0", vite: "^6.0.0" } }, null, 2) + "\n" },
  { name: "tsconfig.json", type: "file", language: "json", content: JSON.stringify({ compilerOptions: { target: "ES2020", module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true }, include: ["src"] }, null, 2) + "\n" },
  { name: "README.md", type: "file", language: "markdown", content: "# AIRIS Project\n\nThis project was scaffolded with AIRIS.\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Features\n- React + TypeScript\n- Vite build tool\n- Tailwind CSS\n" },
];

const scaffoldTemplates: ScaffoldTemplate[] = [
  { name: "React + TypeScript", description: "Modern React app with TypeScript, Vite, and Tailwind", icon: "⚛️", files: [] },
  { name: "Next.js App", description: "Full-stack Next.js application with App Router", icon: "▲", files: [] },
  { name: "Node.js API", description: "Express.js REST API with TypeScript", icon: "🟢", files: [] },
  { name: "Python Flask", description: "Python Flask web application", icon: "🐍", files: [] },
  { name: "Go Service", description: "Go HTTP service with routing", icon: "🔵", files: [] },
  { name: "Rust CLI", description: "Rust command-line application", icon: "🦀", files: [] },
];

interface GeneratedCodeBlock {
  id: string;
  language: string;
  code: string;
  filePath?: string;
  applied: boolean;
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

const languageColors: Record<string, string> = {
  typescript: "text-blue-400", javascript: "text-yellow-400",
  html: "text-orange-400", css: "text-pink-400",
  json: "text-green-400", markdown: "text-purple-400",
  python: "text-blue-300", go: "text-cyan-400",
  rust: "text-orange-300", jsx: "text-cyan-400",
  tsx: "text-blue-400", xml: "text-orange-400",
  bash: "text-emerald-400", sql: "text-yellow-300",
};

function getLangColor(lang?: string) { return languageColors[lang || ""] || "text-muted-foreground"; }

function flattenFiles(nodes: FileNode[], basePath = ""): { path: string; node: FileNode }[] {
  const result: { path: string; node: FileNode }[] = [];
  for (const node of nodes) {
    const path = basePath ? `${basePath}/${node.name}` : node.name;
    result.push({ path, node });
    if (node.children) result.push(...flattenFiles(node.children, path));
  }
  return result;
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", json: "json", html: "html", css: "css", md: "markdown", py: "python", go: "go", rs: "rust", sql: "sql", xml: "xml", yml: "yaml", yaml: "yaml", sh: "bash", bash: "bash" };
  return map[ext] || "plaintext";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: FileTree (Enhanced with right-click context)
// ═══════════════════════════════════════════════════════════

function FileTree({ nodes, depth = 0, onSelectFile, selectedFile, onCreateFile, onDeleteFile, onRenameFile }: {
  nodes: FileNode[]; depth?: number;
  onSelectFile: (node: FileNode, path: string) => void;
  selectedFile?: string;
  onCreateFile?: (parent: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; node: FileNode } | null>(null);
  const allFiles = flattenFiles(sampleFiles);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  return (
    <div className="font-mono text-xs">
      {nodes.map((node) => {
        const key = node.name + depth;
        const isCollapsed = collapsed[key];
        const currentPath = allFiles.find((f) => f.node === node)?.path || node.name;

        return (
          <div key={key}>
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, path: currentPath, node });
              }}
            >
              <button
                onClick={() => {
                  if (node.type === "folder") setCollapsed(p => ({ ...p, [key]: !isCollapsed }));
                  else onSelectFile(node, currentPath);
                }}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors group",
                  node.type === "file" && selectedFile === currentPath
                    ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                {node.type === "folder" ? (
                  isCollapsed ? <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" /> : <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <File className={cn("h-3.5 w-3.5 shrink-0", getLangColor(node.language))} />
                )}
                <span className="truncate flex-1">{node.name}</span>
                {node.type === "file" && selectedFile === currentPath && (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" onClick={(e) => { e.stopPropagation(); onDeleteFile?.(currentPath); }} />
                  </span>
                )}
              </button>
            </div>
            {node.children && !isCollapsed && (
              <FileTree
                nodes={node.children} depth={depth + 1}
                onSelectFile={onSelectFile} selectedFile={selectedFile}
                onCreateFile={onCreateFile} onDeleteFile={onDeleteFile} onRenameFile={onRenameFile}
              />
            )}
          </div>
        );
      })}
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-48 rounded-xl border border-border/50 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === "folder" && (
            <>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => { onCreateFile?.(contextMenu.path); setContextMenu(null); }}>
                <FilePlus className="h-3.5 w-3.5" /> New File
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => { setContextMenu(null); }}>
                <FolderPlus className="h-3.5 w-3.5" /> New Folder
              </button>
            </>
          )}
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => { onRenameFile?.(contextMenu.path); setContextMenu(null); }}>
            <Edit3 className="h-3.5 w-3.5" /> Rename
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-400/10" onClick={() => { onDeleteFile?.(contextMenu.path); setContextMenu(null); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: CodeEditor (Enhanced with AI inline suggestions)
// ═══════════════════════════════════════════════════════════

function CodeEditor({ tab, onContentChange, onSave, onFormat }: {
  tab: Tab | null;
  onContentChange: (path: string, content: string) => void;
  onSave?: (path: string) => void;
  onFormat?: (path: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileCode2 className="mx-auto h-16 w-16 text-muted-foreground/20" />
          <p className="mt-4 text-sm text-muted-foreground">Select a file to edit</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl+P</kbd> Quick Open
            <span className="mx-1">·</span>
            <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl+N</kbd> New File
          </div>
        </div>
      </div>
    );
  }

  const lines = tab.content.split("\n");

  return (
    <div className="flex h-full flex-col">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 bg-[#0a0a0f] px-4 py-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <File className={cn("h-3.5 w-3.5", getLangColor(tab.language))} />
          <span>{tab.path}</span>
          {tab.dirty && <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWordWrap(!wordWrap)} className={cn("rounded px-1.5 py-0.5 text-[10px]", wordWrap ? "text-blue-400" : "text-muted-foreground")}>
            Wrap
          </button>
          <button onClick={() => onFormat?.(tab.path)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
            Format
          </button>
          <button onClick={() => onSave?.(tab.path)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
            Save
          </button>
          <Badge className="bg-blue-400/10 text-blue-300 border-blue-400/20 text-[9px] ml-1">{tab.language}</Badge>
        </div>
      </div>

      {/* Editor body with line numbers */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="select-none border-r border-border/30 bg-[#0a0a0f] px-2 py-4 text-right font-mono text-[11px] leading-[1.55] text-muted-foreground/40">
          {lines.map((_, i) => (
            <div key={i} className="hover:text-muted-foreground/60">{i + 1}</div>
          ))}
        </div>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={tab.content}
          onChange={(e) => onContentChange(tab.path, e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
              e.preventDefault();
              onSave?.(tab.path);
            }
          }}
          className="flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-[1.55] outline-none"
          style={{ whiteSpace: wordWrap ? "pre-wrap" : "pre", tabSize: 2 }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: ChatPanel (Enhanced with code generation)
// ═══════════════════════════════════════════════════════════

function ChatPanel({ onApplyCode, generatedCode }: {
  onApplyCode?: (code: { language: string; code: string; filePath?: string }) => void;
  generatedCode?: GeneratedCodeBlock[];
}) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "w-0", role: "assistant", content: "👋 Welcome to AIRIS IDE! I can help you:\n\n• **Generate code** - Describe what you want\n• **Debug** - Find and fix bugs\n• **Refactor** - Improve existing code\n• **Explain** - Understand complex code\n• **Scaffold** - Create new projects\n\nWhat would you like to do?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateResponse = useCallback(async (userInput: string) => {
    setIsGenerating(true);

    // Simulate code generation based on user input
    const language = userInput.includes("react") || userInput.includes("component") ? "typescript" :
      userInput.includes("python") || userInput.includes("flask") ? "python" :
      userInput.includes("css") || userInput.includes("style") ? "css" : "typescript";

    const codeBlock = `// Generated by AIRIS AI - ${new Date().toLocaleTimeString()}\n\n` +
      (language === "typescript" ?
        `import { useState, useEffect } from 'react';\n\n` +
        `interface Props {\n  title: string;\n  description?: string;\n}\n\n` +
        `export function GeneratedComponent({ title, description }: Props) {\n` +
        `  const [count, setCount] = useState(0);\n\n` +
        `  useEffect(() => {\n` +
        `    console.log('Component mounted: ' + title);\n` +
        `  }, [title]);\n\n` +
        `  return (\n` +
        `    <div className="rounded-lg border p-4">\n` +
        `      <h2 className="text-xl font-bold">{title}</h2>\n` +
        `      {description && <p className="mt-2 text-gray-400">{description}</p>}\n` +
        `      <button\n` +
        `        onClick={() => setCount(c => c + 1)}\n` +
        `        className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"\n` +
        `      >\n` +
        `        Count: {count}\n` +
        `      </button>\n` +
        `    </div>\n` +
        `  );\n` +
        `}\n` :
      `# Generated by AIRIS AI\n\ndef process_data(input_data: list) -> dict:\n` +
      `    """Process and analyze input data."""\n` +
      `    result = {\n` +
      `        "count": len(input_data),\n` +
      `        "sum": sum(input_data),\n` +
      `        "average": sum(input_data) / len(input_data) if input_data else 0,\n` +
      `        "max": max(input_data) if input_data else None,\n` +
      `        "min": min(input_data) if input_data else None,\n` +
      `    }\n` +
      `    return result\n`);

    const filePath = language === "typescript" ? "src/components/Generated.tsx" :
      language === "python" ? "src/utils/processor.py" : "src/styles/generated.css";

    const response: Message = {
      id: `m-${Date.now()}`,
      role: "assistant",
      content: `Here's what I generated for "${userInput}":\n\n` +
        `\`\`\`${language}\n${codeBlock}\n\`\`\`\n\n` +
        `You can **Apply** this code to \`${filePath}\` or modify it further.`,
      codeBlocks: [{ language, code: codeBlock, filePath }],
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, response]);
    setIsGenerating(false);
  }, []);

  const sendMessage = () => {
    if (!input.trim() || isGenerating) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`, role: "user",
      content: input, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    generateResponse(input);
  };

  const applyCodeBlock = (block: { language: string; code: string; filePath?: string }) => {
    onApplyCode?.(block);
    setMessages(prev => [...prev, {
      id: `s-${Date.now()}`, role: "assistant",
      content: `✅ Applied to \`${block.filePath || "current file"}\``,
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-[#0a0a0f] px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-blue-400" /> AI Assistant
        </span>
        {isGenerating && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Generating...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role !== "user" && (
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-400/10">
                  <Bot className="h-3.5 w-3.5 text-blue-400" />
                </div>
              )}
              <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-secondary/30 border border-border/30 text-foreground"
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === "user" && (
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-500">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
            {/* Code blocks with apply button */}
            {msg.codeBlocks?.map((block, ci) => (
              <div key={ci} className="ml-8 mt-1.5 rounded-lg border border-border/30 overflow-hidden">
                <div className="flex items-center justify-between bg-[#0a0a0f] px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <FileCode2 className={cn("h-3 w-3", getLangColor(block.language))} />
                    {block.filePath || `${block.language}`}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => applyCodeBlock(block)}
                      className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/30"
                    >
                      Apply
                    </button>
                    <button className="rounded bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
                      Copy
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto bg-[#0a0a0f]/50 p-3 font-mono text-[10px] leading-5 text-muted-foreground">
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5">
          {[
            "Generate a React component",
            "Debug this file",
            "Create a REST API",
            "Explain TypeScript generics",
          ].map((s) => (
            <button key={s} onClick={() => setInput(s)}
              className="rounded-full border border-border/30 bg-secondary/20 px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 p-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/30 p-1.5">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask AIRIS to generate code..."
            className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
          />
          <Button size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={sendMessage} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: Terminal (Enhanced interactive)
// ═══════════════════════════════════════════════════════════

function TerminalPanel({ onCommand }: { onCommand?: (cmd: string) => void }) {
  const [history, setHistory] = useState<string[]>([
    "$ npm run dev",
    "> airis-project@1.0.0 dev",
    "> vite",
    "",
    "  VITE v6.0.0  ready in 350ms",
    "",
    "  ➜  Local:   http://localhost:5173/",
    "  ➜  Network: http://192.168.1.100:5173/",
    "",
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight);
  }, [history]);

  const executeCommand = (cmd: string) => {
    setHistory(prev => [...prev, `$ ${cmd}`, ...simulateOutput(cmd)]);
    setCmdHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIdx(-1);
    onCommand?.(cmd);
  };

  const simulateOutput = (cmd: string): string[] => {
    if (cmd.startsWith("npm run") || cmd.startsWith("yarn")) return ["> Starting...", "✓ Done"];
    if (cmd.startsWith("git")) return gitCommands(cmd);
    if (cmd.startsWith("ls") || cmd.startsWith("dir")) return ["src/  public/  package.json  tsconfig.json  README.md"];
    if (cmd.startsWith("cd")) return [];
    if (cmd.startsWith("cat") || cmd.startsWith("type")) return ["// File contents would be displayed here"];
    if (cmd.startsWith("echo")) return [cmd.replace("echo ", "")];
    if (cmd.startsWith("clear") || cmd.startsWith("cls")) { setHistory([]); return []; }
    if (cmd.startsWith("node")) return ["> Running Node.js script...", "✓ Script executed successfully"];
    if (cmd === "help") return ["Available: npm, git, ls, cd, cat, echo, clear, node, pwd, mkdir, touch"];
    if (cmd === "pwd") return ["/home/user/airis-project"];
    return [`Command '${cmd}' executed (simulated)`];
  };

  const gitCommands = (cmd: string): string[] => {
    if (cmd.includes("status")) return ["On branch main", "Your branch is up to date", "nothing to commit, working tree clean"];
    if (cmd.includes("log")) return ["commit a1b2c3d (HEAD -> main)", "Author: User", "Date:   Today", "    Initial commit"];
    if (cmd.includes("branch")) return ["* main", "  dev", "  feature/new-ui"];
    return ["Git command executed (simulated)"];
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      <div ref={terminalRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
        {history.map((line, i) => (
          <div key={i} className={
            line.startsWith("$") ? "text-emerald-400" :
            line.includes("ready") ? "text-blue-400" :
            line.startsWith("  ➜") ? "text-cyan-400" :
            line.startsWith("error") || line.startsWith("Error") ? "text-red-400" :
            line.startsWith("warning") ? "text-amber-400" :
            "text-muted-foreground"
          }>
            {line}
          </div>
        ))}
      </div>
      {/* Input line */}
      <div className="flex items-center gap-1 border-t border-border/30 px-3 py-1.5">
        <span className="text-emerald-400 font-mono text-xs">$</span>
        <input
          type="text" value={input} autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { executeCommand(input); setInput(""); }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (cmdHistory.length > 0) {
                const nextIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
                setHistoryIdx(nextIdx);
                setInput(cmdHistory[nextIdx]);
              }
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (historyIdx > 0) {
                const nextIdx = historyIdx - 1;
                setHistoryIdx(nextIdx);
                setInput(cmdHistory[nextIdx]);
              } else {
                setHistoryIdx(-1);
                setInput("");
              }
            }
          }}
          className="flex-1 bg-transparent font-mono text-xs outline-none text-foreground"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: Debugger Panel
// ═══════════════════════════════════════════════════════════

function DebuggerPanel({ onToggleBreakpoint }: { onToggleBreakpoint?: (file: string, line: number) => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([
    { file: "src/App.tsx", line: 5, enabled: true },
    { file: "src/components/Editor.tsx", line: 12, enabled: true },
  ]);
  const [variables, setVariables] = useState([
    { name: "count", value: "0", type: "number" },
    { name: "title", value: '"AIRIS App"', type: "string" },
    { name: "items", value: "Array(3)", type: "array" },
  ]);
  const [callStack, setCallStack] = useState([
    "App.tsx:15", "Editor.tsx:8", "main.tsx:6",
  ]);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Debug toolbar */}
      <div className="flex items-center gap-1 border-b border-border/30 px-3 py-1.5">
        <button onClick={() => setIsRunning(!isRunning)} className={`rounded p-1 ${isRunning ? "text-red-400" : "text-muted-foreground hover:text-foreground"}`}>
          {isRunning ? <Square className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
        </button>
        <button className="rounded p-1 text-muted-foreground hover:text-foreground"><StepOver className="h-3.5 w-3.5" /></button>
        <button className="rounded p-1 text-muted-foreground hover:text-foreground"><StepInto className="h-3.5 w-3.5" /></button>
        <button className="rounded p-1 text-muted-foreground hover:text-foreground"><StepOut className="h-3.5 w-3.5" /></button>
        <button className="rounded p-1 text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
        <span className="ml-2 text-[10px] text-muted-foreground">
          {isRunning ? "Running..." : "Paused"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto text-xs">
        {/* Variables */}
        <div className="border-b border-border/30">
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">Variables</div>
          {variables.map((v) => (
            <div key={v.name} className="flex items-center justify-between px-3 py-1 hover:bg-secondary/30">
              <span className="text-blue-400">{v.name}</span>
              <span className="text-emerald-400 font-mono text-[10px]">{v.value}</span>
            </div>
          ))}
        </div>

        {/* Breakpoints */}
        <div className="border-b border-border/30">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Breakpoints</span>
            <Plus className="h-3 w-3 text-muted-foreground" />
          </div>
          {breakpoints.map((bp, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1 hover:bg-secondary/30">
              <button onClick={() => { const b = [...breakpoints]; b[i].enabled = !b[i].enabled; setBreakpoints(b); }}>
                {bp.enabled ? <Circle className="h-2.5 w-2.5 fill-red-400 text-red-400" /> : <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />}
              </button>
              <span className="text-muted-foreground text-[10px]">{bp.file}:{bp.line}</span>
            </div>
          ))}
        </div>

        {/* Call Stack */}
        <div>
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">Call Stack</div>
          {callStack.map((frame, i) => (
            <div key={i} className={`px-3 py-1 font-mono text-[10px] ${i === 0 ? "text-foreground" : "text-muted-foreground/60"}`}>
              {frame}
            </div>
          ))}
        </div>
      </div>

      {/* Debug console */}
      <div className="border-t border-border/30 p-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">&gt;</span>
          <input type="text" placeholder="Evaluate expression..." className="flex-1 bg-transparent text-[11px] outline-none text-muted-foreground placeholder:text-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}

// Missing icons used in Debugger
function Square(props: { className?: string }) { return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>; }
function StepOver(props: { className?: string }) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="18" y2="12" /><polyline points="14 8 18 12 14 16" /><line x1="18" y1="4" x2="18" y2="20" /></svg>; }
function StepInto(props: { className?: string }) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="14" y2="12" /><polyline points="10 8 14 12 10 16" /><line x1="14" y1="4" x2="14" y2="20" /></svg>; }
function StepOut(props: { className?: string }) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="14" y2="12" /><polyline points="10 8 14 12 10 16" /><line x1="20" y1="4" x2="20" y2="20" /></svg>; }

// ═══════════════════════════════════════════════════════════
// COMPONENT: Project Scaffold Dialog
// ═══════════════════════════════════════════════════════════

function ScaffoldDialog({ onClose, onScaffold }: { onClose: () => void; onScaffold: (template: ScaffoldTemplate) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-border/50 bg-card/95 p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {scaffoldTemplates.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => onScaffold(tpl)}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/20 p-4 text-left transition-colors hover:border-blue-400/30 hover:bg-blue-400/5"
            >
              <span className="text-2xl">{tpl.icon}</span>
              <div>
                <div className="text-sm font-medium">{tpl.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: GitHub Integration Panel
// ═══════════════════════════════════════════════════════════

function GitHubPanel() {
  const [gitStatus, setGitStatus] = useState<GitStatus>({
    branch: "main", changes: 3, staged: 1, commits: 12, remote: "origin"
  });
  const [commitMsg, setCommitMsg] = useState("");

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] p-3">
      {/* Branch info */}
      <div className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 mb-3">
        <GitBranch className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium">{gitStatus.branch}</span>
        <Badge className="bg-blue-400/10 text-blue-300 border-blue-400/20 text-[9px] ml-auto">{gitStatus.commits} commits</Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-1 mb-3">
        <Button size="sm" variant="outline" className="flex-1 gap-1 h-7 text-[10px]">
          <Download className="h-3 w-3" /> Pull
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1 h-7 text-[10px]">
          <Upload className="h-3 w-3" /> Push
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1 h-7 text-[10px]">
          <GitBranch className="h-3 w-3" /> Branch
        </Button>
      </div>

      {/* Status */}
      <div className="text-xs font-medium text-muted-foreground mb-2">Changes ({gitStatus.changes})</div>
      <div className="space-y-1 flex-1 overflow-y-auto mb-3">
        {["src/App.tsx", "src/components/Header.tsx", "src/index.css"].map((f) => (
          <div key={f} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary/30">
            <Badge className="bg-amber-400/10 text-amber-300 border-amber-400/20 text-[8px]">M</Badge>
            <span className="text-muted-foreground">{f}</span>
          </div>
        ))}
      </div>

      {/* Commit */}
      <div className="border-t border-border/30 pt-2">
        <input
          type="text" value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message..."
          className="w-full rounded-lg border border-border/30 bg-secondary/30 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/50 mb-2"
        />
        <Button size="sm" className="w-full gap-1 h-8 text-xs" disabled={!commitMsg.trim()}>
          <GitCommit className="h-3.5 w-3.5" /> Commit
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN IDE COMPONENT
// ═══════════════════════════════════════════════════════════

export default function IDEPage() {
  // Layout state
  const [showFileTree, setShowFileTree] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showDebugger, setShowDebugger] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showScaffold, setShowScaffold] = useState(false);

  // Editor state
  const [selectedFile, setSelectedFile] = useState("src/App.tsx");
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "src/App.tsx", name: "App.tsx", path: "src/App.tsx", language: "typescript", content: sampleFiles[0].children![3].content!, dirty: false, savedContent: sampleFiles[0].children![3].content! },
  ]);
  const [activeTab, setActiveTab] = useState("src/App.tsx");

  // Mobile state
  const [mobileView, setMobileView] = useState<"editor" | "chat" | "files" | "terminal" | "debug">("editor");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // File operations
  const handleSelectFile = (node: FileNode, path: string) => {
    setSelectedFile(path);
    if (!tabs.find((t) => t.id === path) && node.content !== undefined) {
      setTabs((prev) => [...prev, {
        id: path, name: node.name, path, language: node.language || "plaintext",
        content: node.content || "", dirty: false, savedContent: node.content || "",
      }]);
    }
    setActiveTab(path);
  };

  const handleContentChange = (path: string, content: string) => {
    setTabs((prev) => prev.map((t) => t.id === path ? { ...t, content, dirty: content !== t.savedContent } : t));
  };

  const handleSave = (path: string) => {
    setTabs((prev) => prev.map((t) => t.id === path ? { ...t, dirty: false, savedContent: t.content } : t));
  };

  const handleApplyCode = (code: { language: string; code: string; filePath?: string }) => {
    const filePath = code.filePath || `src/generated.${code.language === "typescript" ? "ts" : code.language}`;
    const fileName = filePath.split("/").pop() || "generated.ts";
    const lang = detectLanguage(fileName);
    setTabs((prev) => {
      if (prev.find((t) => t.id === filePath)) {
        return prev.map((t) => t.id === filePath ? { ...t, content: t.content + "\n\n" + code.code, dirty: true } : t);
      }
      return [...prev, { id: filePath, name: fileName, path: filePath, language: lang, content: code.code, dirty: true, savedContent: "" }];
    });
    setActiveTab(filePath);
  };

  const activeTabData = tabs.find((t) => t.id === activeTab) || null;

  // ── DESKTOP LAYOUT ──
  if (!isMobile) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Scaffold Dialog */}
        {showScaffold && <ScaffoldDialog onClose={() => setShowScaffold(false)} onScaffold={(tpl) => { setShowScaffold(false); }} />}

        {/* IDE Top Bar */}
        <header className="flex h-10 items-center justify-between border-b border-border/50 bg-[#0a0a0f] px-3">
          <div className="flex items-center gap-2">
            <Link href="/app" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Zap className="h-3.5 w-3.5 text-blue-400" /> AIRIS IDE
            </Link>
            <span className="text-muted-foreground/20">|</span>
            {/* Toggle buttons */}
            {[
              { icon: PanelLeft, key: "tree", show: showFileTree, set: () => setShowFileTree(!showFileTree) },
              { icon: MessageSquare, key: "chat", show: showChat, set: () => setShowChat(!showChat) },
              { icon: PanelBottom, key: "term", show: showTerminal, set: () => setShowTerminal(!showTerminal) },
              { icon: Bug, key: "debug", show: showDebugger, set: () => setShowDebugger(!showDebugger) },
              { icon: GitBranch, key: "git", show: showGitHub, set: () => setShowGitHub(!showGitHub) },
            ].map(({ icon: Icon, key, show, set }) => (
              <button key={key} onClick={set} className={cn("rounded p-1", show ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowScaffold(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Plus className="h-3 w-3" /> New Project
            </button>
            <Badge className="bg-blue-400/10 text-blue-300 border-blue-400/20 text-[9px]">Gemini 2.0 Pro</Badge>
          </div>
        </header>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          {showFileTree && (
            <div className="w-52 border-r border-border/50 bg-[#0a0a0f] flex flex-col">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Explorer</span>
                <div className="flex gap-0.5">
                  <button onClick={() => setShowScaffold(true)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><FilePlus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                <FileTree nodes={sampleFiles} onSelectFile={handleSelectFile} selectedFile={selectedFile} />
              </div>
            </div>
          )}

          {/* GitHub Panel */}
          {showGitHub && (
            <div className="w-60 border-r border-border/50">
              <div className="flex items-center justify-between border-b border-border/50 bg-[#0a0a0f] px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <Github className="h-3.5 w-3.5" /> Source Control
                </span>
                <button onClick={() => setShowGitHub(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
              <GitHubPanel />
            </div>
          )}

          {/* Editor area */}
          <div className="flex flex-1 flex-col">
            {/* Editor Tabs */}
            <div className="flex border-b border-border/50 bg-[#0a0a0f] overflow-x-auto">
              {tabs.map((tab) => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-r border-border/50 px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors",
                    activeTab === tab.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}>
                  <File className={cn("h-3 w-3", getLangColor(tab.language))} />
                  {tab.name}
                  {tab.dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                </button>
              ))}
              <button className="px-2 py-1.5 text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /></button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor tab={activeTabData} onContentChange={handleContentChange} onSave={handleSave} />
            </div>

            {/* Terminal */}
            {showTerminal && (
              <div className={cn("border-t border-border/50", showDebugger ? "h-32" : "h-40")}>
                <div className="flex items-center justify-between bg-[#0a0a0f] px-3 py-1 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <TerminalIcon className="h-3.5 w-3.5" /> Terminal
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Bug className="h-3.5 w-3.5" /> Problems: 0
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Info className="h-3.5 w-3.5" /> Output
                    </span>
                  </div>
                  <button onClick={() => setShowTerminal(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </div>
                <TerminalPanel />
              </div>
            )}

            {/* Debugger */}
            {showDebugger && (
              <div className="h-32 border-t border-border/50">
                <div className="flex items-center justify-between bg-[#0a0a0f] px-3 py-1 border-b border-border/30">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Bug className="h-3.5 w-3.5" /> Debugger
                  </span>
                  <button onClick={() => setShowDebugger(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </div>
                <DebuggerPanel />
              </div>
            )}
          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="w-80 border-l border-border/50 flex flex-col">
              <ChatPanel onApplyCode={handleApplyCode} />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <footer className="flex h-6 items-center justify-between border-t border-border/50 bg-[#0a0a0f] px-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" /> Ready</span>
            <span>Ln {activeTabData ? activeTabData.content.split("\n").length : 0}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Github className="h-3 w-3" /> main</span>
            <span>{activeTabData?.language || "Plain Text"}</span>
            <span>Spaces: 2</span>
            <span>UTF-8</span>
          </div>
        </footer>
      </div>
    );
  }

  // ── MOBILE LAYOUT ──
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Mobile top bar */}
      <header className="flex h-11 items-center justify-between border-b border-border/50 bg-[#0a0a0f] px-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowScaffold(true)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">AIRIS IDE</span>
        </div>
        <select className="rounded-lg bg-secondary/50 px-2 py-1 text-[11px] outline-none max-w-[140px]">
          {tabs.map((t) => (<option key={t.id}>{t.name}</option>))}
        </select>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mobileView === "editor" && <CodeEditor tab={activeTabData} onContentChange={handleContentChange} onSave={handleSave} />}
        {mobileView === "chat" && <ChatPanel onApplyCode={handleApplyCode} />}
        {mobileView === "files" && (
          <div className="h-full overflow-y-auto p-3">
            <FileTree nodes={sampleFiles} onSelectFile={(n, p) => { handleSelectFile(n, p); setMobileView("editor"); }} selectedFile={selectedFile} />
          </div>
        )}
        {mobileView === "terminal" && <TerminalPanel />}
        {mobileView === "debug" && <DebuggerPanel />}
      </div>

      {/* Mobile bottom nav */}
      <nav className="flex h-14 items-center justify-around border-t border-border/50 bg-[#0a0a0f] px-1">
        {[
          { id: "files" as const, icon: Folder, label: "Files" },
          { id: "editor" as const, icon: FileCode2, label: "Code" },
          { id: "chat" as const, icon: MessageSquare, label: "AI" },
          { id: "terminal" as const, icon: TerminalIcon, label: "Term" },
          { id: "debug" as const, icon: Bug, label: "Debug" },
        ].map((item) => (
          <button key={item.id}
            onClick={() => setMobileView(item.id)}
            className={cn("flex flex-col items-center gap-0.5 px-3 py-1 transition-colors", mobileView === item.id ? "text-blue-400" : "text-muted-foreground")}>
            <item.icon className="h-5 w-5" />
            <span className="text-[9px]">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Scaffold dialog */}
      {showScaffold && <ScaffoldDialog onClose={() => setShowScaffold(false)} onScaffold={() => setShowScaffold(false)} />}
    </div>
  );
}
