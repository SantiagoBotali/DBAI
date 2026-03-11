"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import TableNode from "./TableNode";
import type { DatabaseSchema, TableSchema } from "@/types";
import { RefreshCw, Database } from "lucide-react";

const nodeTypes = { tableNode: TableNode };

function layoutGraph(tables: TableSchema[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });

  const NODE_WIDTH = 230;
  const NODE_HEIGHT_BASE = 80;
  const ROW_HEIGHT = 28;

  const nodes: Node[] = tables.map((table) => {
    const height = NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT;
    g.setNode(table.name, { width: NODE_WIDTH, height });
    return {
      id: table.name,
      type: "tableNode",
      data: { table },
      position: { x: 0, y: 0 },
    };
  });

  const edges: Edge[] = [];

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      const edgeId = `${table.name}-${fk.from}->${fk.to_table}-${fk.to_column}`;
      g.setEdge(table.name, fk.to_table);
      edges.push({
        id: edgeId,
        source: table.name,
        target: fk.to_table,
        label: `${fk.from} → ${fk.to_column}`,
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
        labelStyle: { fill: "#94a3b8", fontSize: 10 },
        labelBgStyle: { fill: "#141420", fillOpacity: 0.8 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 2,
      });
    }
  }

  dagre.layout(g);

  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.position = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (NODE_HEIGHT_BASE + (((node.data as { table: TableSchema }).table.columns.length) * ROW_HEIGHT)) / 2,
      };
    }
  }

  return { nodes, edges };
}

export default function ERDiagram({ refreshTrigger }: { refreshTrigger?: number }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schema");
      if (!res.ok) throw new Error("Failed to load schema");
      const schema: DatabaseSchema = await res.json();

      const { nodes: newNodes, edges: newEdges } = layoutGraph(schema.tables);
      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm">Loading schema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-red-400">
          <Database className="w-8 h-8" />
          <p className="text-sm">{error}</p>
          <button
            onClick={loadSchema}
            className="px-4 py-2 bg-accent rounded-md text-white text-sm hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: "#0a0a0f" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#252540"
        />
        <Controls
          style={{
            background: "#141420",
            border: "1px solid #252540",
            borderRadius: "8px",
          }}
        />
        <MiniMap
          style={{
            background: "#141420",
            border: "1px solid #252540",
            borderRadius: "8px",
          }}
          nodeColor="#6366f1"
          maskColor="rgba(10,10,15,0.7)"
        />
      </ReactFlow>

      <button
        onClick={loadSchema}
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-md text-text-secondary text-sm hover:text-text-primary hover:border-accent transition-colors z-10"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refresh
      </button>

      <div className="absolute bottom-4 left-4 text-text-muted text-xs bg-surface/80 px-2 py-1 rounded border border-border">
        {nodes.length} tables · {edges.length} relationships
      </div>
    </div>
  );
}
