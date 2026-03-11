"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { TableSchema } from "@/types";

interface TableNodeData extends Record<string, unknown> {
  table: TableSchema;
}

const TYPE_COLORS: Record<string, string> = {
  INTEGER: "text-blue-400",
  TEXT: "text-green-400",
  REAL: "text-yellow-400",
  BLOB: "text-purple-400",
  NUMERIC: "text-orange-400",
};

function getTypeColor(type: string): string {
  const upper = type.toUpperCase().split("(")[0].trim();
  return TYPE_COLORS[upper] || "text-text-muted";
}

function TableNodeComponent({ data }: NodeProps) {
  const { table } = data as TableNodeData;

  return (
    <div className="bg-surface border border-border rounded-lg shadow-lg min-w-[200px] overflow-hidden">
      {/* Handle for incoming connections */}
      <Handle type="target" position={Position.Left} className="!bg-accent !border-accent" />

      {/* Table header */}
      <div className="bg-accent/20 border-b border-border px-3 py-2">
        <h3 className="text-text-primary font-bold text-sm font-mono truncate">
          {table.name}
        </h3>
        <p className="text-text-muted text-xs">{table.columns.length} columns</p>
      </div>

      {/* Columns */}
      <div className="divide-y divide-border">
        {table.columns.map((col) => {
          const isFk = table.foreignKeys.some((fk) => fk.from === col.name);
          return (
            <div key={col.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {col.pk && (
                  <span className="text-yellow-400 text-xs shrink-0" title="Primary Key">
                    🔑
                  </span>
                )}
                {isFk && !col.pk && (
                  <span className="text-blue-400 text-xs shrink-0" title="Foreign Key">
                    🔗
                  </span>
                )}
                <span className="text-text-primary text-xs font-mono truncate">
                  {col.name}
                </span>
              </div>
              <span className={`text-xs font-mono shrink-0 ${getTypeColor(col.type)}`}>
                {col.type.split("(")[0].toUpperCase()}
              </span>
              {col.notnull && !col.pk && (
                <span className="text-red-400 text-xs shrink-0" title="NOT NULL">
                  *
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Handle for outgoing connections */}
      <Handle type="source" position={Position.Right} className="!bg-accent !border-accent" />
    </div>
  );
}

export default memo(TableNodeComponent);
