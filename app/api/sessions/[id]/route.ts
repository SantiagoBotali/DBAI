import { NextRequest, NextResponse } from "next/server";
import { deleteSession, renameSession } from "@/lib/sessions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    deleteSession(id);

    // If deleting the active session, switch back to default
    const currentSession = request.cookies.get("session-id")?.value;
    const response = NextResponse.json({ success: true });
    if (currentSession === id) {
      response.cookies.set("session-id", "default", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { name } = await request.json();
    const session = renameSession(id, name);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
