"use client";

import { useState } from "react";
import { ArrowDownTrayIcon, DocumentTextIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

export function ExportMenu({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost text-xs py-1.5 flex items-center gap-1.5"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass-card p-1.5 min-w-[140px] animate-scale-in">
            <a
              href={api.exportConversation(conversationId, "csv")}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            >
              <TableCellsIcon className="w-4 h-4" />
              CSV
            </a>
            <a
              href={api.exportConversation(conversationId, "pdf")}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            >
              <DocumentTextIcon className="w-4 h-4" />
              PDF
            </a>
          </div>
        </>
      )}
    </div>
  );
}
