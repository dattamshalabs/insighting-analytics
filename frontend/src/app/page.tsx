"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

import { DataQualityBanner } from "@/components/chat/DataQualityBanner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RecommendationCard } from "@/components/chat/RecommendationCard";
import { ThoughtProcess } from "@/components/chat/ThoughtProcess";
import { ExportMenu } from "@/components/export/ExportMenu";
import { ChatHistory } from "@/components/ui/ChatHistory";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalyticsChat } from "@/hooks/useAnalyticsChat";
import { api } from "@/lib/api";

// Fallback suggestions if no datasource is connected
const DEFAULT_PROMPTS = [
  "What is our current headcount by department?",
  "Show me attrition trends over the past year",
  "What is the average engagement score by department?",
  "Which employees completed the most training courses?",
];

const messageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export default function ChatPage() {
  const { messages, sessionId, loading, error, sessions, send, loadSession, reset } =
    useAnalyticsChat();
  const [input, setInput] = useState("");
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic suggestions based on connected datasources
  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const datasources = await api.getDatasources();
        if (datasources.length > 0) {
          // Use the first datasource (or default one)
          const dsId = datasources[0].id;
          const suggestions = await api.getSuggestedQuestions(dsId, 8);
          if (suggestions.length > 0) {
            setSuggestedPrompts(suggestions);
          }
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
        // Keep default prompts on error
      } finally {
        setLoadingSuggestions(false);
      }
    }
    fetchSuggestions();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    send(input.trim());
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div className="flex h-screen">
      {/* Chat History Sidebar */}
      <div className="w-56 border-r border-gray-800 p-3 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">History</span>
          <button onClick={reset} className="text-xs text-blue-400 hover:text-blue-300">New</button>
        </div>
        <ChatHistory sessions={sessions} activeSessionId={sessionId} onSelect={loadSession} />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Analytics Chat</h2>
            {sessionId && (
              <span className="text-xs text-gray-500">Session: {sessionId.slice(0, 8)}...</span>
            )}
          </div>
          <div className="flex gap-2">
            {sessionId && <ExportMenu conversationId={sessionId} />}
            <button onClick={reset} className="btn-ghost text-xs py-1.5">
              New Chat
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <h3 className="text-xl font-semibold text-gray-300 mb-2">Ask anything about your HR data</h3>
              <p className="text-sm text-gray-500 mb-8">Explore headcount, attrition, engagement surveys, L&D, and recognition data.</p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl w-full">
                {loadingSuggestions ? (
                  <div className="col-span-2 text-center text-gray-500 text-sm">Loading suggestions...</div>
                ) : (
                  suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setInput(prompt); }}
                      className="glass-card p-3 text-left text-sm text-gray-300 hover:text-gray-100 hover:border-gray-600 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                layout
              >
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
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="ml-12">
              <Skeleton variant="message" count={2} />
            </div>
          )}

          {error && (
            <div className="ml-12 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit} className="glass-card flex items-center gap-3 px-4 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about headcount, attrition, engagement, training, recognition..."
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
