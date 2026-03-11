"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import {
  Play, Loader2, AlertCircle, CheckCircle2, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Database, Key, Hash,
} from "lucide-react";
import type { TableRow, DatabaseSchema } from "@/types";

interface QueryResult {
  rows?: TableRow[];
  columns?: string[];
  affectedRows?: number;
  error?: string;
  executionTime?: number;
}

export default function SQLWorkspace() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    fetch("/api/schema")
      .then((r) => r.json())
      .then(setSchema)
      .catch(() => {});
  }, []);

  const runQuery = useCallback(async () => {
    const q = queryRef.current;
    if (!q.trim() || runningRef.current) return;
    setRunning(true);
    const start = Date.now();
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: q }),
      });
      const data = await res.json();
      setResult({ ...data, executionTime: Date.now() - start });
    } catch (err) {
      setResult({
        error: err instanceof Error ? err.message : "Unknown error",
        executionTime: Date.now() - start,
      });
    } finally {
      setRunning(false);
    }
  }, []);

  // Ctrl+Enter via native capture listener — no @codemirror/view import needed
  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        runQuery();
      }
    };
    el.addEventListener("keydown", handler, true);
    return () => el.removeEventListener("keydown", handler, true);
  }, [runQuery]);

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Schema sidebar */}
      {sidebarOpen ? (
        <div className="flex flex-col w-56 shrink-0 border-r border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Tables
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
              title="Hide sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {!schema && (
              <p className="text-xs text-text-muted px-3 py-2">Loading…</p>
            )}
            {schema?.tables.map((table) => (
              <div key={table.name}>
                <button
                  onClick={() => toggleTable(table.name)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-surface-2 transition-colors text-left"
                >
                  {expandedTables.has(table.name) ? (
                    <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                  )}
                  <Database className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-xs font-mono text-text-primary truncate">
                    {table.name}
                  </span>
                </button>
                {expandedTables.has(table.name) && (
                  <div className="pb-1">
                    {table.columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center gap-1.5 pl-8 pr-3 py-0.5"
                      >
                        {col.pk ? (
                          <Key className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                        ) : (
                          <Hash className="w-2.5 h-2.5 text-text-muted shrink-0" />
                        )}
                        <span className="text-xs font-mono text-text-secondary truncate flex-1">
                          {col.name}
                        </span>
                        <span className="text-xs text-text-muted font-mono shrink-0">
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-2 px-2 py-3 border-r border-border bg-surface hover:bg-surface-2 transition-colors shrink-0"
          title="Show tables"
        >
          <ChevronRight className="w-4 h-4 text-text-muted" />
          <Database className="w-4 h-4 text-text-muted" />
        </button>
      )}

      {/* Main workspace */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <div
          ref={editorContainerRef}
          className="shrink-0 border-b border-border"
          style={{ minHeight: "200px", maxHeight: "40vh" }}
        >
          <div className="h-full overflow-auto">
            <CodeMirror
              value={query}
              onChange={setQuery}
              extensions={[sql()]}
              theme="dark"
              height="100%"
              minHeight="200px"
              style={{ fontSize: "14px" }}
              placeholder="-- Write your SQL query here…"
            />
          </div>
        </div>

        {/* Run button bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={runQuery}
              disabled={!query.trim() || running}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Query
            </button>
            <span className="text-text-muted text-xs">or press Ctrl+Enter</span>
          </div>
          {result?.executionTime !== undefined && (
            <div className="flex items-center gap-1.5 text-text-muted text-xs">
              <Clock className="w-3.5 h-3.5" />
              {result.executionTime}ms
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto min-h-0">
          {result === null && (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Run a query to see results
            </div>
          )}

          {result?.error && (
            <div className="p-6">
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-semibold text-sm mb-1">Query Error</p>
                  <p className="text-red-300 text-sm font-mono">{result.error}</p>
                </div>
              </div>
            </div>
          )}

          {result && !result.error && result.affectedRows !== undefined && (
            <div className="p-6">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <p className="text-green-400 text-sm">
                  Query executed successfully. {result.affectedRows} row(s) affected.
                </p>
              </div>
            </div>
          )}

          {result?.rows && (
            <div>
              <div className="px-6 py-3 border-b border-border bg-surface flex items-center gap-2 sticky top-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-text-secondary text-xs">
                  {result.rows.length} row{result.rows.length !== 1 ? "s" : ""} returned
                </span>
              </div>
              {result.rows.length > 0 ? (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-[41px]">
                    <tr className="bg-surface-2 border-b border-border">
                      {(result.columns || Object.keys(result.rows[0])).map((col) => (
                        <th
                          key={col}
                          className="text-left px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap border-r border-border last:border-r-0"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border hover:bg-surface-2/50 transition-colors"
                      >
                        {(result.columns || Object.keys(row)).map((col) => (
                          <td
                            key={col}
                            className="px-4 py-2.5 font-mono text-xs text-text-primary border-r border-border last:border-r-0 max-w-[300px]"
                          >
                            <div className="truncate" title={row[col]?.toString()}>
                              {row[col] === null ? (
                                <span className="text-text-muted italic">null</span>
                              ) : (
                                String(row[col])
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center py-12 text-text-muted text-sm">
                  Query returned no rows
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
