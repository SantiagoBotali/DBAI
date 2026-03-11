"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";

const ERDiagram = dynamic(() => import("@/components/ERDiagram"), { ssr: false });

export default function SchemaPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>();

  // On mount, check sessionStorage for a pending AI design prompt
  useEffect(() => {
    const pending = sessionStorage.getItem("ai-design-prompt");
    if (pending) {
      sessionStorage.removeItem("ai-design-prompt");
      setInitialPrompt(pending);
    }
  }, []);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <ChatPanel
        context="schema"
        side="left"
        onSchemaUpdate={() => setRefreshTrigger((t) => t + 1)}
        className="w-[40%] min-w-[300px] max-w-[500px]"
        initialPrompt={initialPrompt}
      />
      <ERDiagram refreshTrigger={refreshTrigger} />
    </div>
  );
}
