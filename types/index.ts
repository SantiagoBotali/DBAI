// Database schema types
export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  notnull: boolean;
  dflt_value: string | null;
}

export interface ForeignKey {
  from: string;       // column in this table
  to_table: string;   // referenced table
  to_column: string;  // referenced column
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKey[];
}

export interface DatabaseSchema {
  tables: TableSchema[];
}

// Table data types
export interface TableRow {
  [key: string]: string | number | boolean | null;
}

export interface TableData {
  columns: ColumnInfo[];
  rows: TableRow[];
  total: number;
  page: number;
  limit: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type ViewContext = "schema" | "tables" | "queries";

// Query result types
export interface QueryResult {
  rows?: TableRow[];
  affectedRows?: number;
  columns?: string[];
  error?: string;
}

// Session types
export interface Session {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
