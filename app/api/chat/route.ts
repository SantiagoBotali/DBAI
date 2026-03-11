import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getFullSchema } from "@/lib/schema";
import { executeTool } from "@/lib/toolExecutor";
import { callGemini } from "@/lib/gemini";

const client = new Anthropic();

const claudeTools: Anthropic.Tool[] = [
  {
    name: "create_table",
    description: "Execute DDL to create a new table with columns, types, constraints, and foreign keys.",
    input_schema: { type: "object" as const, properties: { sql: { type: "string", description: "The CREATE TABLE SQL statement." } }, required: ["sql"] },
  },
  {
    name: "alter_table",
    description: "ALTER TABLE — add columns, rename table, etc.",
    input_schema: { type: "object" as const, properties: { sql: { type: "string" } }, required: ["sql"] },
  },
  {
    name: "drop_table",
    description: "Drop an existing table.",
    input_schema: { type: "object" as const, properties: { sql: { type: "string" } }, required: ["sql"] },
  },
  {
    name: "execute_sql",
    description: "Execute arbitrary SQL: INSERT, UPDATE, CREATE INDEX, etc.",
    input_schema: { type: "object" as const, properties: { sql: { type: "string" } }, required: ["sql"] },
  },
  {
    name: "get_schema",
    description: "Retrieve the current database schema.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

async function callClaude(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  sessionId: string,
  send: (event: string, data: unknown) => void
): Promise<void> {
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })
  );

  let continueLoop = true;
  let currentMessages = [...anthropicMessages];
  let schemaChanged = false;

  while (continueLoop) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      tools: claudeTools,
      messages: currentMessages,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        send("text", { text: block.text });
      } else if (block.type === "tool_use") {
        send("tool_start", { name: block.name, id: block.id });

        const toolResult = executeTool(
          block.name,
          block.input as Record<string, string>,
          sessionId
        );

        if (toolResult.schemaChanged) schemaChanged = true;

        send("tool_result", {
          id: block.id,
          name: block.name,
          result: toolResult.result,
          schemaChanged: toolResult.schemaChanged,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResult.result,
        });
      }
    }

    if (toolResults.length > 0) {
      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];
    }

    continueLoop = response.stop_reason === "tool_use";
  }

  if (schemaChanged) send("schema_update", { updated: true });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const { messages, context, model } = await request.json();
        const sessionId = request.cookies.get("session-id")?.value || "default";

        const schema = getFullSchema(sessionId);
        const isEmpty = schema.tables.length === 0;

        const systemPrompt = `You are an expert Database Administrator (DBA) assistant for DBAI.

Current database schema (session: ${sessionId}):
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

${isEmpty ? `⚠️ This is a NEW EMPTY DATABASE. When the user describes what they want to build:
1. First, analyze the requirements — identify all entities, relationships, and key attributes.
2. Validate the design: check for normalization issues, missing FK constraints, appropriate data types.
3. Create tables one by one using create_table, starting with independent tables (no FKs) first.
4. After creating all tables, summarize the schema and ask if the user wants any refinements.
5. Suggest useful indexes for common query patterns.` : ""}

Context: ${context || "Schema view"}

Guidelines:
- Use proper SQLite syntax (TEXT, INTEGER, REAL, BLOB)
- Always add PRIMARY KEY, NOT NULL, FOREIGN KEY constraints where appropriate
- Explain your design decisions briefly
- Be concise in responses`;

        const selectedModel = model || "gemini";

        if (selectedModel === "gemini") {
          await callGemini(systemPrompt, messages, sessionId, send);
        } else if (process.env.VERCEL) {
          send("error", { message: "Claude Haiku is not available in this deployment." });
        } else {
          await callClaude(systemPrompt, messages, sessionId, send);
        }

        send("done", { finished: true });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
