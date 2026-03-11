import { NextRequest, NextResponse } from "next/server";
import { getTableNames } from "@/lib/schema";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const tables = getTableNames(sessionId);
    return NextResponse.json({ tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
