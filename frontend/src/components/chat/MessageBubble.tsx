"use client";

import type { Message } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.chart_url && (
          <img
            src={`${API_URL}${message.chart_url}`}
            alt="Chart"
            className="mt-3 rounded max-w-full"
          />
        )}

        {message.stats && (
          <div className="mt-2 p-2 bg-gray-700/50 rounded text-xs">
            <span className="font-semibold">{message.stats.test_name}</span>
            {message.stats.p_value != null && (
              <span className="ml-2">p = {message.stats.p_value.toFixed(4)}</span>
            )}
            <p className="mt-1 text-gray-300">{message.stats.interpretation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
