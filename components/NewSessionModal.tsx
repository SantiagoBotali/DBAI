"use client";

import { useState } from "react";
import { X, Database, Sparkles, Loader2 } from "lucide-react";
import type { Session } from "@/types";

interface NewSessionModalProps {
  onClose: () => void;
  onCreated: (session: Session) => void;
}

export default function NewSessionModal({ onClose, onCreated }: NewSessionModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"empty" | "ai">("ai");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      const { session } = await res.json();

      // The API already sets the cookie via Set-Cookie header.
      // Also set it client-side to ensure immediate effect for fetch calls.
      document.cookie = `session-id=${session.id}; path=/`;

      const prompt =
        mode === "ai" && description.trim()
          ? `I want to design a database for the following use case:\n\n"${description.trim()}"\n\nPlease:\n1. Analyze the requirements — identify all entities and relationships.\n2. Validate the design (check normalization, missing constraints, appropriate data types).\n3. Create all necessary tables with proper PKs, FKs, and constraints using create_table.\n4. After creating the schema, summarize what was built and ask if anything needs refinement.`
          : undefined;

      // Store the prompt in sessionStorage so the schema page can pick it up
      if (prompt) {
        sessionStorage.setItem("ai-design-prompt", prompt);
      }

      onCreated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent" />
            <h2 className="text-text-primary font-semibold text-lg">New Session</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5 font-medium">
              Session Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. E-commerce Platform, CRM System..."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          {/* Mode selection */}
          <div>
            <label className="block text-xs text-text-secondary mb-2 font-medium">
              How do you want to start?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("empty")}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all ${
                  mode === "empty"
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border bg-surface-2 text-text-secondary hover:border-border-2"
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">Empty Database</span>
                <span className="text-xs text-text-muted leading-tight">
                  Start with a blank DB and design freely
                </span>
              </button>
              <button
                onClick={() => setMode("ai")}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all ${
                  mode === "ai"
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border bg-surface-2 text-text-secondary hover:border-border-2"
                }`}
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">AI Design</span>
                <span className="text-xs text-text-muted leading-tight">
                  Describe your system — AI designs & validates the schema
                </span>
              </button>
            </div>
          </div>

          {/* AI description */}
          {mode === "ai" && (
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                Describe your database
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. "A CRM for a real estate agency with properties, agents, leads, and appointment scheduling. Properties can be for sale or rent, and agents handle multiple clients."`}
                rows={4}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent transition-colors resize-none"
              />
              <p className="mt-1.5 text-xs text-text-muted">
                The AI will analyze requirements, validate the design, and create your schema through an interactive process.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {creating ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
