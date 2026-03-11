"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Database,
  Table2,
  Code2,
  ChevronDown,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import NewSessionModal from "./NewSessionModal";
import type { Session } from "@/types";

const navItems = [
  { href: "/", label: "Schema", icon: Database },
  { href: "/tables", label: "Tables", icon: Table2 },
  { href: "/queries", label: "SQL", icon: Code2 },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read active session from cookie on mount
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;)\s*session-id=([^;]*)/);
    if (match) setActiveSessionId(decodeURIComponent(match[1]));
  }, []);

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadSessions(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setDeleteConfirm(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchSession = (sessionId: string) => {
    document.cookie = `session-id=${sessionId}; path=/`;
    setActiveSessionId(sessionId);
    setDropdownOpen(false);
    setDeleteConfirm(null);
    // Hard navigate so all components reload with the new session
    window.location.href = "/";
  };

  const handleSessionCreated = (session: Session) => {
    setActiveSessionId(session.id);
    setShowNewModal(false);
    // Navigate to schema view — the ChatPanel will pick up the prompt from sessionStorage
    window.location.href = "/";
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (deleteConfirm !== sessionId) {
      setDeleteConfirm(sessionId);
      return;
    }
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (activeSessionId === sessionId) {
        document.cookie = "session-id=default; path=/";
        window.location.href = "/";
      } else {
        loadSessions();
        setDeleteConfirm(null);
      }
    } catch { /* ignore */ }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <>
      <nav className="flex items-center h-14 px-6 border-b border-border bg-surface shrink-0 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Database className="w-5 h-5 text-accent" />
          <span className="text-text-primary font-bold text-lg tracking-tight">DBAI</span>
        </div>

        {/* View links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Session selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setDropdownOpen((o) => !o); setDeleteConfirm(null); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-2 hover:border-accent/50 text-text-primary text-sm transition-colors max-w-[240px]"
          >
            <Database className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">{activeSession?.name ?? "Practice Database"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Sessions</p>
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isConfirming = deleteConfirm === session.id;
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-2 px-3 py-2.5 hover:bg-surface-2 transition-colors group cursor-pointer ${
                        isActive ? "bg-accent/10" : ""
                      }`}
                      onClick={() => !isActive && switchSession(session.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isActive ? (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${isActive ? "text-accent font-medium" : "text-text-primary"}`}>
                            {session.name}
                          </p>
                          {session.description && (
                            <p className="text-xs text-text-muted truncate">{session.description}</p>
                          )}
                          <p className="text-xs text-text-muted">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {!session.isDefault && (
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          title={isConfirming ? "Click again to confirm delete" : "Delete session"}
                          className={`shrink-0 p-1.5 rounded transition-colors ${
                            isConfirming
                              ? "text-red-400 bg-red-500/10"
                              : "text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border p-2">
                <button
                  onClick={() => { setDropdownOpen(false); setShowNewModal(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Session
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {showNewModal && (
        <NewSessionModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleSessionCreated}
        />
      )}
    </>
  );
}
