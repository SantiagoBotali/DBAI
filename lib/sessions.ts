import fs from "fs";
import path from "path";

export interface Session {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function validateSessionId(sessionId: string): void {
  if (sessionId !== "default" && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error("Invalid session ID");
  }
}

export function getDbFilePath(sessionId: string): string {
  validateSessionId(sessionId);
  if (sessionId === "default") {
    return path.join(DATA_DIR, "database.sqlite");
  }
  return path.join(DATA_DIR, `${sessionId}.sqlite`);
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getSessions(): Session[] {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) {
    const defaultSession: Session = {
      id: "default",
      name: "Practice Database",
      description: "Seeded e-commerce & HR practice database",
      createdAt: new Date().toISOString(),
      isDefault: true,
    };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([defaultSession], null, 2));
    return [defaultSession];
  }
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8")) as Session[];
  } catch {
    return [];
  }
}

export function getSession(id: string): Session | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function createSession(name: string, description?: string): Session {
  const sessions = getSessions();
  const id = `session-${Date.now()}`;
  const session: Session = {
    id,
    name: name.trim(),
    description: description?.trim(),
    createdAt: new Date().toISOString(),
  };
  sessions.push(session);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  return session;
}

export function deleteSession(id: string): void {
  if (id === "default") throw new Error("Cannot delete the default session");
  const sessions = getSessions().filter((s) => s.id !== id);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  const dbPath = getDbFilePath(id);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

export function renameSession(id: string, name: string): Session {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Session not found");
  sessions[idx].name = name.trim();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  return sessions[idx];
}
