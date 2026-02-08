"use client";

import { useState } from "react";
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Conversation } from "@/types";

interface ChatHistoryProps {
  sessions: Conversation[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

function groupByDate(sessions: Conversation[]) {
  const groups: { label: string; items: Conversation[] }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayItems: Conversation[] = [];
  const yesterdayItems: Conversation[] = [];
  const weekItems: Conversation[] = [];
  const olderItems: Conversation[] = [];

  sessions.forEach((s) => {
    const d = new Date(s.updated_at);
    if (d.toDateString() === today.toDateString()) {
      todayItems.push(s);
    } else if (d.toDateString() === yesterday.toDateString()) {
      yesterdayItems.push(s);
    } else if (d > weekAgo) {
      weekItems.push(s);
    } else {
      olderItems.push(s);
    }
  });

  if (todayItems.length) groups.push({ label: "Today", items: todayItems });
  if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems });
  if (weekItems.length) groups.push({ label: "This Week", items: weekItems });
  if (olderItems.length) groups.push({ label: "Older", items: olderItems });

  return groups;
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onRename?: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [hovered, setHovered] = useState(false);

  const handleSaveRename = () => {
    if (editTitle.trim() && onRename) {
      onRename(editTitle.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 bg-surface-300 border border-white/[0.1] rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-brand-500/40"
        />
        <button onClick={handleSaveRename} className="p-1 text-emerald-400 hover:text-emerald-300">
          <CheckIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative"
    >
      <button
        onClick={onSelect}
        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all relative group ${
          isActive
            ? "bg-brand-500/10 text-brand-400"
            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-brand-500 rounded-r-full" />
        )}
        <span className={`block truncate text-[12px] ${isActive ? "font-medium text-zinc-200" : "text-zinc-400"}`}>
          {session.title || "Untitled"}
        </span>
        <span className="text-[10px] text-zinc-700">{timeAgo(session.updated_at)}</span>
      </button>

      {/* Action buttons on hover */}
      {hovered && (onDelete || onRename) && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-surface-200/90 backdrop-blur-sm rounded-md px-0.5 py-0.5">
          {onRename && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditTitle(session.title);
                setEditing(true);
              }}
              className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Rename"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatHistory({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onRename,
}: ChatHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-zinc-700">No conversations yet</p>
      </div>
    );
  }

  const groups = groupByDate(sessions);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[10px] font-medium text-zinc-700 uppercase tracking-wider mb-1">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSelect={() => onSelect(s.id)}
                onDelete={onDelete ? () => onDelete(s.id) : undefined}
                onRename={onRename ? (title) => onRename(s.id, title) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
