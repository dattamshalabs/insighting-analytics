"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { LLMLog, QueryLog } from "@/types";

export default function AdminPage() {
  const [tab, setTab] = useState<"llm" | "query" | "cache">("llm");
  const [llmLogs, setLlmLogs] = useState<LLMLog[]>([]);
  const [queryLogs, setQueryLogs] = useState<QueryLog[]>([]);
  const [cacheStats, setCacheStats] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (tab === "llm") setLlmLogs(await api.getLLMLogs());
    else if (tab === "query") setQueryLogs(await api.getQueryLogs());
    else setCacheStats(await api.getCacheStats());
  }, [tab]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-lg font-semibold mb-4">Admin / Observability</h2>

      <div className="flex gap-2 mb-4">
        {(["llm", "query", "cache"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}
          >
            {t === "llm" ? "LLM Logs" : t === "query" ? "Query Logs" : "Cache"}
          </button>
        ))}
        <button onClick={refresh} className="ml-auto px-3 py-1.5 bg-gray-800 rounded text-sm hover:bg-gray-700">
          Refresh
        </button>
      </div>

      {tab === "llm" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Model</th>
                <th className="text-right py-2">Prompt</th>
                <th className="text-right py-2">Response</th>
                <th className="text-right py-2">Latency</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {llmLogs.map((l) => (
                <tr key={l.id} className="border-b border-gray-800">
                  <td className="py-1.5">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-1.5">{l.model}</td>
                  <td className="py-1.5 text-right">{l.prompt_length}</td>
                  <td className="py-1.5 text-right">{l.response_length}</td>
                  <td className="py-1.5 text-right">{l.latency_ms?.toFixed(0)} ms</td>
                  <td className="py-1.5 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "query" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">SQL</th>
                <th className="text-right py-2">Rows</th>
                <th className="text-right py-2">Duration</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {queryLogs.map((l) => (
                <tr key={l.id} className="border-b border-gray-800">
                  <td className="py-1.5">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-1.5 font-mono truncate max-w-[300px]">{l.sql}</td>
                  <td className="py-1.5 text-right">{l.rows_returned ?? "-"}</td>
                  <td className="py-1.5 text-right">{l.duration_ms?.toFixed(0)} ms</td>
                  <td className="py-1.5 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cache" && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          {Object.entries(cacheStats).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-400">{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <button
            onClick={async () => { await api.clearCache(); refresh(); }}
            className="mt-3 px-3 py-1.5 bg-red-900 text-red-300 rounded text-sm hover:bg-red-800"
          >
            Clear Cache
          </button>
        </div>
      )}
    </div>
  );
}
