"use client";

import TableBrowser from "@/components/TableBrowser";
import ChatPanel from "@/components/ChatPanel";

export default function TablesPage() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <TableBrowser />
      <ChatPanel
        context="tables"
        side="right"
        className="w-[320px] shrink-0"
      />
    </div>
  );
}
