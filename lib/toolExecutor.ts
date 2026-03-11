import { getDb } from "@/lib/db";
import { getFullSchema } from "@/lib/schema";

// Dangerous patterns that should never be executed
const BLOCKED_PATTERNS = [
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bLOAD_EXTENSION\b/i,
];

// Validate that the SQL matches the expected tool intent
function validateToolSql(toolName: string, sql: string): string | null {
  const upper = sql.trim().toUpperCase();

  // Block dangerous patterns in any tool
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      return "This SQL operation is not permitted";
    }
  }

  // Validate SQL matches the tool's intended purpose
  switch (toolName) {
    case "create_table":
      if (!upper.startsWith("CREATE TABLE") && !upper.startsWith("CREATE TEMP TABLE")) {
        return "create_table tool only accepts CREATE TABLE statements";
      }
      break;
    case "alter_table":
      if (!upper.startsWith("ALTER TABLE")) {
        return "alter_table tool only accepts ALTER TABLE statements";
      }
      break;
    case "drop_table":
      if (!upper.startsWith("DROP TABLE")) {
        return "drop_table tool only accepts DROP TABLE statements";
      }
      break;
    case "execute_sql":
      // Allow most SQL but block schema-level DDL that should go through specific tools
      break;
  }

  return null;
}

export function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
  sessionId: string
): { result: string; schemaChanged: boolean } {
  const db = getDb(sessionId);

  try {
    if (toolName === "get_schema") {
      return {
        result: JSON.stringify(getFullSchema(sessionId), null, 2),
        schemaChanged: false,
      };
    }

    const sql = toolInput.sql;
    if (!sql) return { result: "Error: No SQL provided.", schemaChanged: false };

    // Validate SQL safety for this tool
    const validationError = validateToolSql(toolName, sql);
    if (validationError) {
      return { result: `Error: ${validationError}`, schemaChanged: false };
    }

    const upper = sql.trim().toUpperCase();

    if (
      upper.startsWith("SELECT") ||
      upper.startsWith("WITH") ||
      upper.startsWith("PRAGMA")
    ) {
      const rows = db.prepare(sql).all();
      return { result: JSON.stringify(rows, null, 2), schemaChanged: false };
    } else {
      // Use db.prepare().run() instead of db.exec() to prevent multi-statement execution
      db.prepare(sql).run();
      const schemaChanged =
        upper.startsWith("CREATE") ||
        upper.startsWith("ALTER") ||
        upper.startsWith("DROP");
      return {
        result: `OK: ${sql.substring(0, 120)}${sql.length > 120 ? "..." : ""}`,
        schemaChanged,
      };
    }
  } catch (error) {
    return {
      result: `Error: ${error instanceof Error ? error.message : String(error)}`,
      schemaChanged: false,
    };
  }
}
