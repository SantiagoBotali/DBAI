import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Patterns that should never be allowed from user-submitted SQL
const DANGEROUS_PATTERNS = [
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bLOAD_EXTENSION\b/i,
  /\bPRAGMA\s+(?!table_info|foreign_key_list)\b/i,
];

// Allowed write operations (must be explicit)
const ALLOWED_WRITE_PREFIXES = ["INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"];

function validateSql(sql: string): string | null {
  const trimmed = sql.trim();

  // Block multiple statements (prevent piggyback injection)
  if (trimmed.includes(";") && trimmed.indexOf(";") < trimmed.length - 1) {
    const afterSemicolon = trimmed.substring(trimmed.indexOf(";") + 1).trim();
    if (afterSemicolon.length > 0) {
      return "Multiple SQL statements are not allowed";
    }
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "This SQL operation is not permitted";
    }
  }

  return null; // valid
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const { sql } = await request.json();

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
    }

    // Validate SQL safety
    const validationError = validateSql(sql);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 403 });
    }

    const db = getDb(sessionId);
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.startsWith("PRAGMA")) {
      const rows = db.prepare(sql).all();
      const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
      return NextResponse.json({ rows, columns });
    } else {
      // Verify it's an allowed write operation
      const isAllowed = ALLOWED_WRITE_PREFIXES.some(p => trimmed.startsWith(p));
      if (!isAllowed) {
        return NextResponse.json({ error: "This SQL operation is not permitted" }, { status: 403 });
      }
      const result = db.prepare(sql).run();
      return NextResponse.json({ affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid });
    }
  } catch (error) {
    console.error("[/api/query] SQL error:", error);
    return NextResponse.json({ error: "Query execution failed" }, { status: 400 });
  }
}
