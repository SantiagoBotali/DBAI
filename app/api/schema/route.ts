import { NextRequest, NextResponse } from "next/server";
import { getFullSchema } from "@/lib/schema";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session-id")?.value || "default";
    const schema = getFullSchema(sessionId);
    return NextResponse.json(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
