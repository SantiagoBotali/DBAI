import { executeTool } from "./toolExecutor";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const functionDeclarations = [
  {
    name: "create_table",
    description: "Execute DDL to create a new table with columns, types, constraints, and foreign keys.",
    parameters: {
      type: "object",
      properties: { sql: { type: "string", description: "The CREATE TABLE SQL statement." } },
      required: ["sql"],
    },
  },
  {
    name: "alter_table",
    description: "ALTER TABLE — add columns, rename table, etc.",
    parameters: {
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    },
  },
  {
    name: "drop_table",
    description: "Drop an existing table.",
    parameters: {
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    },
  },
  {
    name: "execute_sql",
    description: "Execute arbitrary SQL: INSERT, UPDATE, CREATE INDEX, etc.",
    parameters: {
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    },
  },
  {
    name: "get_schema",
    description: "Retrieve the current database schema.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, string> };
  functionResponse?: { name: string; response: unknown };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

async function geminiRequest(contents: GeminiContent[], systemInstruction: string) {
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export async function callGemini(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  sessionId: string,
  send: (event: string, data: unknown) => void
): Promise<void> {
  // Convert to Gemini format (roles: user/model, must alternate)
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let schemaChanged = false;
  const MAX_ITERATIONS = 15;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    const data = await geminiRequest(contents, systemPrompt);
    const candidate = data.candidates?.[0];
    if (!candidate) break;

    const parts: GeminiPart[] = candidate.content?.parts || [];
    const functionCalls = parts.filter((p: GeminiPart) => p.functionCall);
    const textParts = parts.filter((p: GeminiPart) => p.text);

    // Emit text
    for (const part of textParts) {
      if (part.text) send("text", { text: part.text });
    }

    if (functionCalls.length === 0) break;

    // Append model response to history
    contents.push({ role: "model", parts });

    // Execute tools and collect responses
    const responseParts: GeminiPart[] = [];
    for (const part of functionCalls) {
      const fc = part.functionCall!;
      send("tool_start", { name: fc.name, id: fc.name });

      const toolResult = executeTool(fc.name, fc.args, sessionId);
      if (toolResult.schemaChanged) schemaChanged = true;

      send("tool_result", {
        id: fc.name,
        name: fc.name,
        result: toolResult.result,
        schemaChanged: toolResult.schemaChanged,
      });

      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { result: toolResult.result },
        },
      });
    }

    // Append function results as user message
    contents.push({ role: "user", parts: responseParts });
  }

  if (iteration >= MAX_ITERATIONS) {
    send("text", { text: "\n⚠️ Maximum tool iterations reached. Stopping." });
  }

  if (schemaChanged) send("schema_update", { updated: true });
}
