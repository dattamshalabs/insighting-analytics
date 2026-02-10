// API client for the backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "insighting_access_token";
const REFRESH_TOKEN_KEY = "insighting_refresh_token";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      // Clear tokens on refresh failure
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }

    const data = await res.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the request with new token
      return request<T>(path, options, false);
    }
    // Redirect to login if refresh failed
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Types ---
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
  Recommendation,
  SchemaMap,
  SmtpConfig,
  SmtpConfigCreate,
  SuggestedQuestionsResponse,
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

  // On-demand recommendations
  getRecommendations: (messageId: string, sessionId: string) =>
    request<{ recommendations: Recommendation[] }>("/chat/recommendations", {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, session_id: sessionId }),
    }),

  // Message feedback
  submitFeedback: (messageId: string, rating: "up" | "down") =>
    request<{ status: string }>("/chat/feedback", {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, rating }),
    }),

  // Conversation management
  renameSession: (sessionId: string, title: string) =>
    request<Conversation>(`/chat/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  deleteSession: (sessionId: string) =>
    request<{ status: string }>(`/chat/sessions/${sessionId}`, {
      method: "DELETE",
    }),

  // Datasources
  getDatasources: () => request<Datasource[]>("/datasources"),

  createDatasource: (data: DatasourceCreate) =>
    request<Datasource>("/datasources", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteDatasource: (id: string) =>
    request<void>(`/datasources/${id}`, { method: "DELETE" }),

  uploadDatasource: async (file: File, name?: string) => {
    const token = getAccessToken();
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/datasources/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        const retryRes = await fetch(`${API_URL}/datasources/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
        if (!retryRes.ok) throw new Error(`Upload failed: ${retryRes.status}`);
        return retryRes.json() as Promise<Datasource>;
      }
      throw new Error("Session expired. Please log in again.");
    }

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<Datasource>;
  },

  refreshSchema: (id: string) =>
    request<{ tables: number; relations: number }>(
      `/datasources/${id}/refresh-schema`,
      { method: "POST" }
    ),

  // Schema
  getSchema: (datasourceId: string) =>
    request<SchemaMap>(`/schema/${datasourceId}`),

  getSuggestedQuestions: (datasourceId?: string) => {
    const qs = datasourceId ? `?datasource_id=${datasourceId}` : "";
    return request<SuggestedQuestionsResponse>(`/schema/suggested-questions${qs}`);
  },

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

  // Dashboards
  generateDashboard: (prompt: string, datasource_id?: string) =>
    request<DashboardResponse>("/dashboards/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, datasource_id }),
    }),

  getDashboards: () => request<DashboardResponse[]>("/dashboards"),

  getDashboard: (id: string) => request<DashboardResponse>(`/dashboards/${id}`),

  deleteDashboard: (id: string) =>
    request<void>(`/dashboards/${id}`, { method: "DELETE" }),

  iterateDashboard: (id: string, feedback: string) =>
    request<DashboardResponse>(`/dashboards/${id}/iterate`, {
      method: "PATCH",
      body: JSON.stringify({ feedback }),
    }),

  getDashboardIterations: (id: string) =>
    request<DashboardIteration[]>(`/dashboards/${id}/iterations`),

  getDashboardPrompts: (datasourceId?: string) => {
    const qs = datasourceId ? `?datasource_id=${datasourceId}` : "";
    return request<{ prompts: string[] }>(`/dashboards/suggested-prompts${qs}`);
  },

  sendDashboardEmail: (dashboardId: string, recipients: string[], subject?: string) =>
    request<{ status: string; message: string }>("/dashboards/email", {
      method: "POST",
      body: JSON.stringify({ dashboard_id: dashboardId, recipients, subject }),
    }),

  // SMTP
  getSmtpConfig: () => request<SmtpConfig | null>("/admin/smtp"),

  saveSmtpConfig: (data: SmtpConfigCreate) =>
    request<SmtpConfig>("/admin/smtp", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  testSmtpConnection: () =>
    request<{ status: string; message: string }>("/admin/smtp/test", {
      method: "POST",
    }),
};

// Dashboard types
interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

export interface DashboardResponse {
  id: string;
  title: string;
  datasource_id?: string;
  prompt?: string;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

export interface DashboardIteration {
  id: string;
  dashboard_id: string;
  iteration_number: number;
  feedback: string;
  created_at: string;
}
