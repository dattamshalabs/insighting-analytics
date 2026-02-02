"use client";

import type { Conversation } from "@/types";

interface ChatHistoryProps {
  sessions: Conversation[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ChatHistory({ sessions, activeSessionId, onSelect }: ChatHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500 text-center">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
            s.id === activeSessionId
              ? "bg-blue-600/20 text-blue-400"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <span className="block truncate font-medium text-gray-200">{s.title || "Untitled"}</span>
          <span className="text-gray-500">{timeAgo(s.updated_at)}</span>
        </button>
      ))}
    </div>
  );
}
