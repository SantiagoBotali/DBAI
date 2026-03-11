import { getDb } from "./db";
import type { ColumnInfo, ForeignKey, TableSchema, DatabaseSchema } from "@/types";

interface PragmaTableInfo {
  cid: number; name: string; type: string;
  notnull: number; dflt_value: string | null; pk: number;
}
interface PragmaForeignKey {
  id: number; seq: number; table: string;
  from: string; to: string; on_update: string; on_delete: string; match: string;
}
interface SqliteMasterRow { name: string }

export function getFullSchema(sessionId = "default"): DatabaseSchema {
  const db = getDb(sessionId);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as SqliteMasterRow[];

  const tableSchemas: TableSchema[] = tables.map((t) => {
    const columns = db.prepare(`PRAGMA table_info(${JSON.stringify(t.name)})`).all() as PragmaTableInfo[];
    const fks = db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(t.name)})`).all() as PragmaForeignKey[];
    return {
      name: t.name,
      columns: columns.map((c): ColumnInfo => ({
        name: c.name, type: c.type, pk: c.pk > 0,
        notnull: c.notnull === 1, dflt_value: c.dflt_value,
      })),
      foreignKeys: fks.map((fk): ForeignKey => ({
        from: fk.from, to_table: fk.table, to_column: fk.to,
      })),
    };
  });
  return { tables: tableSchemas };
}

export function getTableNames(sessionId = "default"): string[] {
  const db = getDb(sessionId);
  return (db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as SqliteMasterRow[]).map((t) => t.name);
}

export function getTableSchema(tableName: string, sessionId = "default"): TableSchema | null {
  const db = getDb(sessionId);
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").all(tableName) as SqliteMasterRow[];
  if (!rows.length) return null;
  const columns = db.prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`).all() as PragmaTableInfo[];
  const fks = db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(tableName)})`).all() as PragmaForeignKey[];
  return {
    name: tableName,
    columns: columns.map((c): ColumnInfo => ({
      name: c.name, type: c.type, pk: c.pk > 0,
      notnull: c.notnull === 1, dflt_value: c.dflt_value,
    })),
    foreignKeys: fks.map((fk): ForeignKey => ({
      from: fk.from, to_table: fk.table, to_column: fk.to,
    })),
  };
}
