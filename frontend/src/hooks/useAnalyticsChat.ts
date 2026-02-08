"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ChatResponse, Conversation, Message, Recommendation } from "@/types";

export function useAnalyticsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Conversation[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const all = await api.getSessions();
      setSessions(all.slice(0, 30));
    } catch {
      // silently fail — sessions sidebar is non-critical
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const send = useCallback(
    async (query: string, datasourceId?: string) => {
      setLoading(true);
      setError(null);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        recommendations: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const resp: ChatResponse = await api.chat(query, sessionId, datasourceId);
        setSessionId(resp.session_id);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: resp.answer,
          generated_sql: resp.generated_sql,
          generated_code: resp.generated_code,
          chart_url: resp.chart_url,
          recommendations: resp.recommendations,
          data_quality: resp.data_quality,
          stats: resp.stats,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        loadSessions();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loadSessions]
  );

  const loadSession = useCallback(async (sid: string) => {
    setLoading(true);
    setError(null);
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
    loadSessions();
  }, [loadSessions]);

  // On-demand recommendations
  const fetchRecommendations = useCallback(
    async (messageId: string): Promise<Recommendation[]> => {
      if (!sessionId) return [];
      try {
        const resp = await api.getRecommendations(messageId, sessionId);
        // Update the message in state with the new recommendations
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, recommendations: resp.recommendations } : m
          )
        );
        return resp.recommendations;
      } catch {
        return [];
      }
    },
    [sessionId]
  );

  // Message feedback
  const submitFeedback = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      try {
        await api.submitFeedback(messageId, rating);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, feedback: rating } : m
          )
        );
      } catch {
        // silently fail
      }
    },
    []
  );

  // Conversation management
  const deleteSession = useCallback(
    async (sid: string) => {
      try {
        await api.deleteSession(sid);
        if (sid === sessionId) {
          reset();
        }
        loadSessions();
      } catch {
        // silently fail
      }
    },
    [sessionId, reset, loadSessions]
  );

  const renameSession = useCallback(
    async (sid: string, title: string) => {
      try {
        await api.renameSession(sid, title);
        loadSessions();
      } catch {
        // silently fail
      }
    },
    [loadSessions]
  );

  return {
    messages,
    sessionId,
    loading,
    error,
    sessions,
    send,
    loadSession,
    loadSessions,
    reset,
    fetchRecommendations,
    submitFeedback,
    deleteSession,
    renameSession,
  };
}
