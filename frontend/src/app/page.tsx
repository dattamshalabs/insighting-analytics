"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  ArrowPathIcon,
  ChartBarIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  BoltIcon,
} from "@heroicons/react/24/solid";
import {
  PlusIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

import { DataQualityBanner } from "@/components/chat/DataQualityBanner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RecommendationCard } from "@/components/chat/RecommendationCard";
import { ThoughtProcess } from "@/components/chat/ThoughtProcess";
import { ExportMenu } from "@/components/export/ExportMenu";
import { ChatHistory } from "@/components/ui/ChatHistory";
import { useAnalyticsChat } from "@/hooks/useAnalyticsChat";

const SUGGESTED_PROMPTS = [
  {
    text: "Show me total revenue by month",
    icon: ChartBarIcon,
    color: "from-blue-500/20 to-blue-600/10",
  },
  {
    text: "What are the top 10 customers by order count?",
    icon: TableCellsIcon,
    color: "from-emerald-500/20 to-emerald-600/10",
  },
  {
    text: "Compare sales this quarter vs last quarter",
    icon: MagnifyingGlassIcon,
    color: "from-purple-500/20 to-purple-600/10",
  },
  {
    text: "Find anomalies in recent transactions",
    icon: BoltIcon,
    color: "from-amber-500/20 to-amber-600/10",
  },
];

const messageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20 flex items-center justify-center shrink-0">
        <SparklesIcon className="w-4 h-4 text-brand-400" />
      </div>
      <div className="glass-card px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-typing-dot-1" />
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-typing-dot-2" />
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-typing-dot-3" />
        <span className="ml-2 text-xs text-zinc-500">Analyzing your data...</span>
      </div>
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in px-4">
      {/* Animated gradient orb */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/10 flex items-center justify-center animate-float">
          <SparklesIcon className="w-10 h-10 text-brand-400" />
        </div>
        <div className="absolute -inset-4 bg-brand-500/5 rounded-3xl blur-2xl -z-10" />
      </div>

      <h2 className="text-2xl font-bold text-gradient-subtle mb-2 text-center">
        What would you like to know?
      </h2>
      <p className="text-sm text-zinc-600 mb-10 max-w-md text-center leading-relaxed">
        Ask questions about your data in plain English. I&apos;ll generate SQL, run analytics,
        and visualize the results.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {SUGGESTED_PROMPTS.map(({ text, icon: Icon, color }) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className="glass-card-interactive group p-4 text-left"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
              <Icon className="w-4 h-4 text-zinc-300" />
            </div>
            <p className="text-[13px] text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">
              {text}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const {
    messages,
    sessionId,
    loading,
    error,
    sessions,
    send,
    loadSession,
    reset,
    fetchRecommendations,
    submitFeedback,
    deleteSession,
    renameSession,
  } = useAnalyticsChat();

  const [input, setInput] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Smart auto-scroll
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const handleScroll = () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollDown(!isNearBottom);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages.length, loading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    send(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const filteredSessions = sessions.filter((s) =>
    !historySearch || s.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      {/* Chat History Sidebar */}
      <div className="w-64 border-r border-white/[0.06] flex flex-col shrink-0 bg-surface-50/50">
        {/* History header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">
            History
          </span>
          <button
            onClick={reset}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all"
            title="New Chat"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <input
            type="text"
            placeholder="Search chats..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="w-full bg-surface-200/50 border border-white/[0.04] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-brand-500/30 transition-colors"
          />
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          <ChatHistory
            sessions={filteredSessions}
            activeSessionId={sessionId}
            onSelect={loadSession}
            onDelete={deleteSession}
            onRename={renameSession}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b border-white/[0.06] px-6 h-14 flex items-center justify-between shrink-0 bg-surface-0/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-200 tracking-tight">Analytics Chat</h2>
            {sessionId && (
              <span className="badge-neutral text-[10px]">
                {sessionId.slice(0, 8)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sessionId && <ExportMenu conversationId={sessionId} />}
            <button
              onClick={reset}
              className="btn-ghost text-xs py-1.5 flex items-center gap-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin relative"
        >
          {messages.length === 0 && !loading && (
            <EmptyState onSelect={(text) => { setInput(text); textareaRef.current?.focus(); }} />
          )}

          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  layout
                >
                  <MessageBubble
                    message={msg}
                    onFeedback={submitFeedback}
                  />

                  {msg.role === "assistant" && msg.data_quality && msg.data_quality.issues.length > 0 && (
                    <div className="mt-2">
                      <DataQualityBanner report={msg.data_quality} />
                    </div>
                  )}

                  {msg.role === "assistant" && (msg.generated_sql || msg.generated_code) && (
                    <div className="mt-2">
                      <ThoughtProcess sql={msg.generated_sql} code={msg.generated_code} />
                    </div>
                  )}

                  {/* Recommendation prompt - lazy loaded */}
                  {msg.role === "assistant" && (
                    <RecommendationCard
                      message={msg}
                      onFetchRecommendations={fetchRecommendations}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <TypingIndicator />
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 max-w-3xl"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <span className="text-red-400 text-xs font-bold">!</span>
                </div>
                <div className="flex-1 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={() => {
                      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
                      if (lastUserMsg) send(lastUserMsg.content);
                    }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollDown && messages.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={scrollToBottom}
                className="fixed bottom-24 right-1/2 translate-x-1/2 z-10 p-2.5 bg-surface-300 border border-white/[0.1] rounded-full shadow-elevated hover:bg-surface-400 transition-colors"
              >
                <ArrowDownIcon className="w-4 h-4 text-zinc-300" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="px-6 pb-4 pt-2 shrink-0">
          <form
            onSubmit={handleSubmit}
            className="glass-card flex items-end gap-3 px-4 py-3 max-w-3xl mx-auto"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none min-h-[24px] max-h-[160px] leading-relaxed"
              disabled={loading}
            />
            <div className="flex items-center gap-2 shrink-0 pb-0.5">
              <span className="text-[10px] text-zinc-700 hidden sm:block">
                Enter to send
              </span>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2 rounded-lg bg-brand-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-400 transition-all shadow-glow-sm disabled:shadow-none"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
