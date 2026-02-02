"use client";

import { FormEvent, useRef, useState } from "react";

import { DataQualityBanner } from "@/components/chat/DataQualityBanner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RecommendationCard } from "@/components/chat/RecommendationCard";
import { ThoughtProcess } from "@/components/chat/ThoughtProcess";
import { ExportMenu } from "@/components/export/ExportMenu";
import { useAnalyticsChat } from "@/hooks/useAnalyticsChat";

export default function ChatPage() {
  const { messages, sessionId, loading, error, send, reset } =
    useAnalyticsChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    send(input.trim());
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Analytics Chat</h2>
          {sessionId && (
            <span className="text-xs text-gray-500">Session: {sessionId.slice(0, 8)}...</span>
          )}
        </div>
        <div className="flex gap-2">
          {sessionId && <ExportMenu conversationId={sessionId} />}
          <button
            onClick={reset}
            className="px-3 py-1 text-sm bg-gray-800 rounded hover:bg-gray-700"
          >
            New Chat
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-xl mb-2">Ask anything about your data</p>
            <p className="text-sm">Connect a datasource first, then start querying.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble message={msg} />

            {msg.role === "assistant" && msg.data_quality && msg.data_quality.issues.length > 0 && (
              <DataQualityBanner report={msg.data_quality} />
            )}

            {msg.role === "assistant" && (msg.generated_sql || msg.generated_code) && (
              <ThoughtProcess sql={msg.generated_sql} code={msg.generated_code} />
            )}

            {msg.role === "assistant" && msg.recommendations.length > 0 && (
              <div className="ml-12 space-y-2 mt-2">
                {msg.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 ml-12">
            <div className="animate-pulse">Thinking...</div>
          </div>
        )}

        {error && (
          <div className="ml-12 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-800 px-6 py-4"
      >
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
