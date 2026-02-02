// API client for the backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Chat ---
import type {
  Alert,
  AlertCreate,
  ChatResponse,
  Conversation,
  ConversationDetail,
  Datasource,
  DatasourceCreate,
  GlossaryTerm,
  GlossaryTermCreate,
  LLMLog,
  QueryLog,
  SchemaMap,
} from "@/types";

export const api = {
  // Chat
  chat: (query: string, session_id?: string, datasource_id?: string) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ query, session_id, datasource_id }),
    }),

  getSessions: () => request<Conversation[]>("/chat/sessions"),

  getHistory: (sessionId: string) =>
    request<ConversationDetail>(`/chat/history/${sessionId}`),

  // Datasources
  getDatasources: () => request<Datasource[]>("/datasources"),

  createDatasource: (data: DatasourceCreate) =>
    request<Datasource>("/datasources", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteDatasource: (id: string) =>
    request<void>(`/datasources/${id}`, { method: "DELETE" }),

  refreshSchema: (id: string) =>
    request<{ tables: number; relations: number }>(
      `/datasources/${id}/refresh-schema`,
      { method: "POST" }
    ),

  // Schema
  getSchema: (datasourceId: string) =>
    request<SchemaMap>(`/schema/${datasourceId}`),

  // Export
  exportConversation: (conversationId: string, format: "csv" | "pdf") =>
    `${API_URL}/export/${conversationId}?format=${format}`,

  // Alerts
  getAlerts: () => request<Alert[]>("/alerts"),

  createAlert: (data: AlertCreate) =>
    request<Alert>("/alerts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAlert: (id: string, data: Partial<AlertCreate>) =>
    request<Alert>(`/alerts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAlert: (id: string) =>
    request<void>(`/alerts/${id}`, { method: "DELETE" }),

  // Glossary
  getGlossary: () => request<GlossaryTerm[]>("/glossary"),

  createGlossaryTerm: (data: GlossaryTermCreate) =>
    request<GlossaryTerm>("/glossary", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateGlossaryTerm: (id: string, data: Partial<GlossaryTermCreate>) =>
    request<GlossaryTerm>(`/glossary/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteGlossaryTerm: (id: string) =>
    request<void>(`/glossary/${id}`, { method: "DELETE" }),

  // Admin
  getLLMLogs: (limit = 100) =>
    request<LLMLog[]>(`/admin/logs/llm?limit=${limit}`),

  getQueryLogs: (limit = 100) =>
    request<QueryLog[]>(`/admin/logs/query?limit=${limit}`),

  getCacheStats: () =>
    request<Record<string, number>>("/admin/cache/stats"),

  clearCache: () =>
    request<{ status: string }>("/admin/cache/clear", { method: "POST" }),
};
