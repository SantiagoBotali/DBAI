import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTableSchema } from "@/lib/schema";

interface RouteContext {
  params: Promise<{ table: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { table } = await context.params;
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const offset = (page - 1) * limit;

    const schema = getTableSchema(table, sessionId);
    if (!schema) {
      return NextResponse.json({ error: `Table '${table}' not found` }, { status: 404 });
    }

    const db = getDb(sessionId);
    const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${JSON.stringify(table)}`).get() as { count: number };
    const rows = db.prepare(`SELECT * FROM ${JSON.stringify(table)} LIMIT ? OFFSET ?`).all(limit, offset);

    return NextResponse.json({ columns: schema.columns, rows, total: count, page, limit });
  } catch (error) {
    console.error("[/api/tables/[table]] GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve table data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { table } = await context.params;
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const body = await request.json();

    const schema = getTableSchema(table, sessionId);
    if (!schema) {
      return NextResponse.json({ error: `Table '${table}' not found` }, { status: 404 });
    }

    const db = getDb(sessionId);
    const providedColumns = schema.columns.filter(
      (c) => !c.pk && body[c.name] !== undefined && body[c.name] !== ""
    );

    if (!providedColumns.length) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const colNames = providedColumns.map((c) => c.name).join(", ");
    const placeholders = providedColumns.map(() => "?").join(", ");
    const values = providedColumns.map((c) => body[c.name]);

    const result = db
      .prepare(`INSERT INTO ${JSON.stringify(table)} (${colNames}) VALUES (${placeholders})`)
      .run(...values);

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    console.error("[/api/tables/[table]] POST error:", error);
    return NextResponse.json({ error: "Failed to insert record" }, { status: 400 });
  }
}
