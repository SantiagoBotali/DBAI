import { NextRequest, NextResponse } from "next/server";
import { getSessions, createSession } from "@/lib/sessions";

export async function GET() {
  try {
    const sessions = getSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[/api/sessions] GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Session name is required" }, { status: 400 });
    }
    const session = createSession(name, description);

    // Return the session with a Set-Cookie header so the client activates it immediately
    const response = NextResponse.json({ session }, { status: 201 });
    response.cookies.set("session-id", session.id, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return response;
  } catch (error) {
    console.error("[/api/sessions] POST error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
