"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, Bot, User, Plus, MessageSquare, Search, Settings, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const sampleSessions = [
  { id: "1", title: "Code review for auth module", date: "2 min ago", model: "Gemini 2.0 Pro" },
  { id: "2", title: "Building REST API endpoints", date: "1 hour ago", model: "Claude 3.5" },
  { id: "3", title: "Debug database connection", date: "Yesterday", model: "GPT-4o" },
  { id: "4", title: "Refactoring React components", date: "2 days ago", model: "DeepSeek V3" },
];

const suggestions = [
  "Review my current project structure",
  "Help me write unit tests",
  "Explain this error message",
  "Generate API documentation",
  "Optimize this code for performance",
];

export default function WorkspacePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AIRIS AI assistant. I can help you code, debug, analyze, and automate. What would you like to work on today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedSession, setSelectedSession] = useState("1");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `I'll help you with "${input}". Let me analyze that for you. *(AI response simulation — connect a provider for real AI)*`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="hidden w-72 flex-col border-r border-border/50 bg-[#0a0a0f] lg:flex">
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <span className="text-sm font-medium">Sessions</span>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative border-b border-border/50 p-2">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions..."
            className="w-full rounded-lg bg-secondary/50 py-2 pl-9 pr-3 text-xs outline-none"
          />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {sampleSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedSession(session.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedSession === session.id
                  ? "bg-blue-500/10 text-blue-400"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-start justify-between">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="ml-2 flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium">{session.title}</div>
                  <div className="text-xs text-muted-foreground/70">{session.date} · {session.model}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role !== "user" && (
                  <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-400/10">
                    <Bot className="h-4 w-4 text-blue-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.role === "system"
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-secondary/50 text-foreground border border-border/40"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-500">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className="mb-2 text-xs text-muted-foreground">Suggestions</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border/50 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-secondary/30 p-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask AIRIS anything..."
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={sendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
              AI responses are simulated in preview. Connect a provider for real AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
