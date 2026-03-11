import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTableSchema } from "@/lib/schema";

interface RouteContext {
  params: Promise<{ table: string; id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { table, id } = await context.params;
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const body = await request.json();

    const schema = getTableSchema(table, sessionId);
    if (!schema) return NextResponse.json({ error: `Table '${table}' not found` }, { status: 404 });

    const pkColumn = schema.columns.find((c) => c.pk);
    if (!pkColumn) return NextResponse.json({ error: "No primary key" }, { status: 400 });

    const db = getDb(sessionId);
    const updatable = schema.columns.filter((c) => !c.pk && body[c.name] !== undefined);
    if (!updatable.length) return NextResponse.json({ error: "No updatable fields" }, { status: 400 });

    const setClauses = updatable.map((c) => `${JSON.stringify(c.name)} = ?`).join(", ");
    db.prepare(`UPDATE ${JSON.stringify(table)} SET ${setClauses} WHERE ${JSON.stringify(pkColumn.name)} = ?`)
      .run(...updatable.map((c) => body[c.name]), id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/tables/[table]/[id]] PUT error:", error);
    return NextResponse.json({ error: "Failed to update record" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { table, id } = await context.params;
    const sessionId = request.cookies.get("session-id")?.value || "default";

    const schema = getTableSchema(table, sessionId);
    if (!schema) return NextResponse.json({ error: `Table '${table}' not found` }, { status: 404 });

    const pkColumn = schema.columns.find((c) => c.pk);
    if (!pkColumn) return NextResponse.json({ error: "No primary key" }, { status: 400 });

    const db = getDb(sessionId);
    db.prepare(`DELETE FROM ${JSON.stringify(table)} WHERE ${JSON.stringify(pkColumn.name)} = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/tables/[table]/[id]] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 400 });
  }
}
