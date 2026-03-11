"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import type { ColumnInfo, TableRow } from "@/types";

interface RecordModalProps {
  tableName: string;
  columns: ColumnInfo[];
  record?: TableRow | null;
  onClose: () => void;
  onSave: () => void;
}

export default function RecordModal({
  tableName,
  columns,
  record,
  onClose,
  onSave,
}: RecordModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!record;
  const pkColumn = columns.find((c) => c.pk);

  useEffect(() => {
    if (record) {
      const data: Record<string, string> = {};
      for (const col of columns) {
        data[col.name] = record[col.name]?.toString() || "";
      }
      setFormData(data);
    } else {
      const data: Record<string, string> = {};
      for (const col of columns) {
        data[col.name] = "";
      }
      setFormData(data);
    }
  }, [record, columns]);

  const editableColumns = columns.filter((c) => {
    if (isEdit) return !c.pk; // can't edit PK
    return !c.pk; // skip auto-increment PK on create
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string | null> = {};
      for (const col of editableColumns) {
        const val = formData[col.name];
        body[col.name] = val === "" ? null : val;
      }

      let url = `/api/tables/${encodeURIComponent(tableName)}`;
      let method = "POST";

      if (isEdit && pkColumn && record) {
        url = `/api/tables/${encodeURIComponent(tableName)}/${record[pkColumn.name]}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const getInputType = (col: ColumnInfo): string => {
    const type = col.type.toUpperCase();
    if (type.includes("INT") || type.includes("REAL") || type.includes("NUMERIC")) {
      return "number";
    }
    if (type.includes("DATE")) return "date";
    return "text";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-text-primary font-semibold">
              {isEdit ? "Edit Record" : "New Record"}
            </h2>
            <p className="text-text-muted text-sm font-mono">{tableName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Show PK as read-only in edit mode */}
          {isEdit && pkColumn && (
            <div>
              <label className="block text-xs text-text-muted mb-1 font-mono">
                {pkColumn.name} <span className="text-yellow-400">(PK)</span>
              </label>
              <input
                type="text"
                value={record?.[pkColumn.name]?.toString() || ""}
                disabled
                className="w-full bg-surface-2/50 border border-border rounded-lg px-3 py-2 text-text-muted text-sm font-mono cursor-not-allowed"
              />
            </div>
          )}

          {editableColumns.map((col) => (
            <div key={col.name}>
              <label className="block text-xs text-text-secondary mb-1 font-mono">
                {col.name}{" "}
                <span className="text-text-muted">
                  {col.type}
                  {col.notnull ? " · required" : ""}
                </span>
              </label>
              <input
                type={getInputType(col)}
                value={formData[col.name] || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, [col.name]: e.target.value }))
                }
                required={col.notnull && !col.dflt_value}
                placeholder={col.dflt_value ? `default: ${col.dflt_value}` : ""}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ))}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
