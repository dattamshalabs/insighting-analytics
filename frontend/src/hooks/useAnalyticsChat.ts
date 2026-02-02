"use client";

import { useCallback, useState } from "react";

import { api } from "@/lib/api";
import type { ChatResponse, Message } from "@/types";

export function useAnalyticsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (query: string, datasourceId?: string) => {
      setLoading(true);
      setError(null);

      // Optimistic user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        recommendations: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const resp: ChatResponse = await api.chat(
          query,
          sessionId,
          datasourceId
        );
        setSessionId(resp.session_id);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: resp.answer,
          generated_sql: resp.generated_sql,
          chart_url: resp.chart_url,
          recommendations: resp.recommendations,
          data_quality: resp.data_quality,
          stats: resp.stats,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const loadSession = useCallback(async (sid: string) => {
    setLoading(true);
    try {
      const detail = await api.getHistory(sid);
      setSessionId(detail.id);
      setMessages(detail.messages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
  }, []);

  return { messages, sessionId, loading, error, send, loadSession, reset };
}
