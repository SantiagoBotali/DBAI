"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Table2, RefreshCw, AlertTriangle } from "lucide-react";
import RecordModal from "./RecordModal";
import type { ColumnInfo, TableRow } from "@/types";

interface TableData {
  columns: ColumnInfo[];
  rows: TableRow[];
  total: number;
  page: number;
  limit: number;
}

export default function TableBrowser() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TableRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TableRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LIMIT = 50;

  // Load table list
  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data) => {
        setTables(data.tables || []);
        if (data.tables?.length > 0) setSelectedTable(data.tables[0]);
      })
      .catch(console.error);
  }, []);

  // Load table data
  const loadTableData = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tables/${encodeURIComponent(selectedTable)}?page=${page}&limit=${LIMIT}`
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTableData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedTable]);

  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  const handleDelete = async (record: TableRow) => {
    if (!selectedTable || !tableData) return;
    const pkCol = tableData.columns.find((c) => c.pk);
    if (!pkCol) return;

    setDeleting(true);
    try {
      await fetch(
        `/api/tables/${encodeURIComponent(selectedTable)}/${record[pkCol.name]}`,
        { method: "DELETE" }
      );
      setDeleteConfirm(null);
      loadTableData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const pkColumn = tableData?.columns.find((c) => c.pk);
  const totalPages = tableData ? Math.ceil(tableData.total / LIMIT) : 0;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-text-primary text-sm font-semibold flex items-center gap-2">
            <Table2 className="w-4 h-4 text-accent" />
            Tables
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {tables.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTable(t)}
              className={`w-full text-left px-4 py-2 text-sm font-mono transition-colors ${
                selectedTable === t
                  ? "bg-accent/20 text-accent border-r-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedTable ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0 bg-surface">
              <div>
                <h2 className="text-text-primary font-semibold font-mono">{selectedTable}</h2>
                {tableData && (
                  <p className="text-text-muted text-xs">
                    {tableData.total} rows · {tableData.columns.length} columns
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadTableData}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button
                  onClick={() => { setEditRecord(null); setModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Record
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : tableData ? (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-2 border-b border-border">
                      {tableData.columns.map((col) => (
                        <th
                          key={col.name}
                          className="text-left px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap border-r border-border last:border-r-0"
                        >
                          <div className="flex items-center gap-1">
                            {col.pk && <span className="text-yellow-400">🔑</span>}
                            {col.name}
                            <span className="text-text-muted ml-1 font-normal">
                              {col.type.split("(")[0]}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-text-secondary text-xs w-20 shrink-0">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border hover:bg-surface-2/50 transition-colors"
                      >
                        {tableData.columns.map((col) => (
                          <td
                            key={col.name}
                            className="px-4 py-2.5 font-mono text-xs text-text-primary border-r border-border last:border-r-0 max-w-[250px]"
                          >
                            <div className="truncate" title={row[col.name]?.toString()}>
                              {row[col.name] === null ? (
                                <span className="text-text-muted italic">null</span>
                              ) : (
                                String(row[col.name])
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditRecord(row); setModalOpen(true); }}
                              className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(row)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={tableData.columns.length + 1}
                          className="text-center py-12 text-text-muted"
                        >
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface shrink-0">
                <span className="text-text-muted text-xs">
                  Page {page} of {totalPages} · {tableData?.total} total rows
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded hover:bg-surface-2 text-text-secondary disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded hover:bg-surface-2 text-text-secondary disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            Select a table to browse data
          </div>
        )}
      </div>

      {/* Record Modal */}
      {modalOpen && selectedTable && tableData && (
        <RecordModal
          tableName={selectedTable}
          columns={tableData.columns}
          record={editRecord}
          onClose={() => { setModalOpen(false); setEditRecord(null); }}
          onSave={loadTableData}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-text-primary font-semibold">Delete Record</h3>
                <p className="text-text-muted text-sm">This action cannot be undone.</p>
              </div>
            </div>
            {pkColumn && (
              <p className="text-text-secondary text-sm mb-6">
                Delete record with {pkColumn.name} = <span className="font-mono text-text-primary">{deleteConfirm[pkColumn.name]?.toString()}</span>?
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
