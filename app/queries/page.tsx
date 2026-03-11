"use client";

import SQLWorkspace from "@/components/SQLWorkspace";
import ChatPanel from "@/components/ChatPanel";

export default function QueriesPage() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <SQLWorkspace />
      <ChatPanel
        context="queries"
        side="right"
        className="w-[320px] shrink-0"
      />
    </div>
  );
}
