"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ClockIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import type { LLMLog, QueryLog } from "@/types";

function MiniLatencyChart({ logs }: { logs: LLMLog[] }) {
  const data = useMemo(
    () =>
      logs
        .filter((l) => l.latency_ms != null)
        .slice(-20)
        .map((l) => ({
          time: new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latency: l.latency_ms!,
        })),
    [logs]
  );
  if (data.length < 2) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-medium text-gray-400 mb-2">LLM Latency (ms)</h3>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
          />
          <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniErrorChart({ logs }: { logs: LLMLog[] }) {
  const data = useMemo(() => {
    const errors = logs.filter((l) => l.error).length;
    const success = logs.length - errors;
    return [
      { name: "Success", count: success, color: "#10b981" },
      { name: "Error", count: errors, color: "#ef4444" },
    ];
  }, [logs]);

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-medium text-gray-400 mb-2">Success / Error</h3>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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

  const avgLatency = useMemo(() => {
    const valid = llmLogs.filter((l) => l.latency_ms != null);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((s, l) => s + l.latency_ms!, 0) / valid.length);
  }, [llmLogs]);

  const errorCount = useMemo(() => llmLogs.filter((l) => l.error).length, [llmLogs]);

  const tabs = ["llm", "query", "cache"] as const;

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-lg font-semibold mb-4 tracking-tight">Admin / Observability</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total LLM Calls" value={llmLogs.length} icon={<CpuChipIcon className="w-6 h-6" />} />
        <StatCard label="Avg Latency" value={`${avgLatency}ms`} icon={<ClockIcon className="w-6 h-6" />} />
        <StatCard label="Errors" value={errorCount} icon={<ExclamationTriangleIcon className="w-6 h-6" />} />
        <StatCard label="Query Logs" value={queryLogs.length} icon={<ServerIcon className="w-6 h-6" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors relative ${
              tab === t ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t === "llm" ? "LLM Logs" : t === "query" ? "Query Logs" : "Cache"}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
        <button onClick={refresh} className="ml-auto btn-ghost text-xs py-1.5 mb-1">
          Refresh
        </button>
      </div>

      {tab === "llm" && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <MiniLatencyChart logs={llmLogs} />
            <MiniErrorChart logs={llmLogs} />
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-2.5 px-3">Time</th>
                  <th className="text-left py-2.5 px-3">Model</th>
                  <th className="text-right py-2.5 px-3">Prompt</th>
                  <th className="text-right py-2.5 px-3">Response</th>
                  <th className="text-right py-2.5 px-3">Latency</th>
                  <th className="text-left py-2.5 px-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {llmLogs.map((l, i) => (
                  <tr key={l.id} className={`border-b border-gray-800 ${i % 2 === 1 ? "bg-gray-800/20" : ""}`}>
                    <td className="py-2 px-3">{new Date(l.created_at).toLocaleTimeString()}</td>
                    <td className="py-2 px-3">{l.model}</td>
                    <td className="py-2 px-3 text-right">{l.prompt_length}</td>
                    <td className="py-2 px-3 text-right">{l.response_length}</td>
                    <td className="py-2 px-3 text-right">{l.latency_ms?.toFixed(0)} ms</td>
                    <td className="py-2 px-3 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "query" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2.5 px-3">Time</th>
                <th className="text-left py-2.5 px-3">SQL</th>
                <th className="text-right py-2.5 px-3">Rows</th>
                <th className="text-right py-2.5 px-3">Duration</th>
                <th className="text-left py-2.5 px-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {queryLogs.map((l, i) => (
                <tr key={l.id} className={`border-b border-gray-800 ${i % 2 === 1 ? "bg-gray-800/20" : ""}`}>
                  <td className="py-2 px-3">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-2 px-3 font-mono truncate max-w-[300px]">{l.sql}</td>
                  <td className="py-2 px-3 text-right">{l.rows_returned ?? "-"}</td>
                  <td className="py-2 px-3 text-right">{l.duration_ms?.toFixed(0)} ms</td>
                  <td className="py-2 px-3 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cache" && (
        <div className="glass-card p-4 space-y-2">
          {Object.entries(cacheStats).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-400">{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <button
            onClick={async () => { await api.clearCache(); refresh(); }}
            className="mt-3 px-3 py-1.5 bg-red-900/60 text-red-300 rounded-xl text-sm hover:bg-red-800/60 transition-colors"
          >
            Clear Cache
          </button>
        </div>
      )}
    </div>
  );
}
