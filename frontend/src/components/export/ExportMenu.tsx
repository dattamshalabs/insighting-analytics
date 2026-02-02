"use client";

import { api } from "@/lib/api";

export function ExportMenu({ conversationId }: { conversationId: string }) {
  return (
    <div className="flex gap-1">
      <a
        href={api.exportConversation(conversationId, "csv")}
        className="px-3 py-1 text-sm bg-gray-800 rounded hover:bg-gray-700"
        download
      >
        CSV
      </a>
      <a
        href={api.exportConversation(conversationId, "pdf")}
        className="px-3 py-1 text-sm bg-gray-800 rounded hover:bg-gray-700"
        download
      >
        PDF
      </a>
    </div>
  );
}
