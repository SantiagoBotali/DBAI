"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, ChevronLeft, ChevronRight, Bot, User, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ViewContext } from "@/types";

interface ChatPanelProps {
  context?: ViewContext;
  onSchemaUpdate?: () => void;
  className?: string;
  side?: "left" | "right";
  initialPrompt?: string;
}

const contextHints: Record<ViewContext, string> = {
  schema: "You are viewing the ER diagram. Ask me to create or modify tables.",
  tables: "You are browsing table data. Ask me about relationships or schema design.",
  queries: "You are in the SQL editor. Ask me to explain queries or design schemas.",
};

const defaultWelcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your AI DBA assistant. I can help you design schemas, create tables, write queries, and understand your database. What would you like to do?",
  timestamp: new Date(),
};

export default function ChatPanel({
  context = "schema",
  onSchemaUpdate,
  className = "",
  side = "left",
  initialPrompt,
}: ChatPanelProps) {
  const storageKey = useMemo(() => {
    if (typeof document === "undefined") return `chat-messages-default-${context}`;
    const sid = document.cookie.match(/session-id=([^;]+)/)?.[1] ?? "default";
    return `chat-messages-${sid}-${context}`;
  }, [context]);

  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcome]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "haiku">("gemini");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialPromptSent = useRef(false);
  // True after the initial sessionStorage load has been applied
  const loadedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Single effect: load on first run, save on every subsequent run.
  // Using a ref instead of two separate effects prevents the save from
  // overwriting stored data before the load's setMessages re-render completes.
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Array<Omit<ChatMessage, "timestamp"> & { timestamp: string }>;
          const msgs = parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
          if (msgs.length > 0) {
            setMessages(msgs);
            return; // skip saving until the re-render with loaded data
          }
        }
      } catch {}
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  const clearConversation = useCallback(() => {
    const fresh: ChatMessage = { ...defaultWelcome, timestamp: new Date() };
    loadedRef.current = true; // already initialized, next run will save
    setMessages([fresh]);
    try { sessionStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  const sendMessage = useCallback(
    async (overrideInput?: string) => {
      const text = overrideInput ?? input;
      if (!text.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      if (!overrideInput) setInput("");
      setIsStreaming(true);

      try {
        const history = messages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: userMessage.content });

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            context: contextHints[context],
            model: selectedModel,
          }),
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("event: ")) {
              const eventType = line.slice(7).trim();
              const dataLine = lines[i + 1];
              if (dataLine?.startsWith("data: ")) {
                const data = JSON.parse(dataLine.slice(6));

                if (eventType === "text") {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + data.text,
                      };
                    }
                    return updated;
                  });
                } else if (eventType === "tool_start") {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content:
                          last.content +
                          `\n\n*Executing: \`${data.name}\`...*\n`,
                      };
                    }
                    return updated;
                  });
                } else if (eventType === "schema_update") {
                  onSchemaUpdate?.();
                } else if (eventType === "error") {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: `Error: ${data.message}`,
                      };
                    }
                    return updated;
                  });
                }
              }
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, something went wrong. Please try again.",
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [input, isStreaming, messages, context, onSchemaUpdate]
  );

  // Auto-send initial prompt once on mount
  useEffect(() => {
    if (initialPrompt && !initialPromptSent.current) {
      initialPromptSent.current = true;
      const timer = setTimeout(() => sendMessage(initialPrompt), 600);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const borderClass = side === "right" ? "border-l border-r-0" : "border-r";
  const collapsedBorderClass = side === "right" ? "border-l" : "border-r";

  // ── Collapsed state ── intentionally does NOT include the parent className
  // so that width constraints from the parent don't override w-10
  if (collapsed) {
    return (
      <div
        className={`flex flex-col items-center py-4 w-10 bg-surface ${collapsedBorderClass} border-border shrink-0`}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-md hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors"
          title="Expand assistant"
        >
          {side === "right" ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <div
          className="mt-4 text-text-muted text-xs tracking-widest select-none"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          AI Assistant
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-surface ${borderClass} border-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          <span className="text-text-primary text-sm font-semibold">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearConversation}
            className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-red-400 transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
            title="Collapse"
          >
            {side === "right" ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                message.role === "assistant" ? "bg-accent/20" : "bg-surface-2"
              }`}
            >
              {message.role === "assistant" ? (
                <Bot className="w-4 h-4 text-accent" />
              ) : (
                <User className="w-4 h-4 text-text-secondary" />
              )}
            </div>
            <div
              className={`flex-1 rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                message.role === "user"
                  ? "bg-accent/20 text-text-primary ml-auto"
                  : "bg-surface-2 text-text-primary"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>
                    {message.content || (isStreaming ? "..." : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            </div>
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI DBA anything..."
            rows={2}
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedModel("gemini")}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                selectedModel === "gemini"
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Gemini Flash
            </button>
            <button
              disabled
              title="Not available in this deployment"
              className="px-2 py-0.5 rounded-full text-xs font-medium opacity-40 cursor-not-allowed text-text-muted"
            >
              Haiku
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
