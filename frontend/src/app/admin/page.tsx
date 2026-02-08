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
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { LLMLog, QueryLog } from "@/types";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#18181b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    fontSize: 11,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "#71717a" },
};

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
      <h3 className="text-xs font-medium text-zinc-600 mb-3">LLM Latency (ms)</h3>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={1.5} dot={false} />
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
      <h3 className="text-xs font-medium text-zinc-600 mb-3">Success / Error</h3>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
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
  const { toast } = useToast();

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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Admin / Observability</h2>
          <p className="text-sm text-zinc-600 mt-0.5">Monitor LLM calls, queries, and cache performance</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total LLM Calls" value={llmLogs.length} icon={<CpuChipIcon className="w-5 h-5" />} />
        <StatCard label="Avg Latency" value={`${avgLatency}ms`} icon={<ClockIcon className="w-5 h-5" />} />
        <StatCard label="Errors" value={errorCount} icon={<ExclamationTriangleIcon className="w-5 h-5" />} />
        <StatCard label="Query Logs" value={queryLogs.length} icon={<ServerIcon className="w-5 h-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm transition-colors relative ${
              tab === t ? "text-brand-400" : "text-zinc-600 hover:text-zinc-300"
            }`}
          >
            {t === "llm" ? "LLM Logs" : t === "query" ? "Query Logs" : "Cache"}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
        <button
          onClick={refresh}
          className="ml-auto btn-ghost text-xs py-1.5 mb-1 flex items-center gap-1.5"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {tab === "llm" && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <MiniLatencyChart logs={llmLogs} />
            <MiniErrorChart logs={llmLogs} />
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-600 border-b border-white/[0.06]">
                  <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Model</th>
                  <th className="text-right py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Prompt</th>
                  <th className="text-right py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Response</th>
                  <th className="text-right py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Latency</th>
                  <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody>
                {llmLogs.map((l, i) => (
                  <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-4 text-zinc-400">{new Date(l.created_at).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-4 text-zinc-300">{l.model}</td>
                    <td className="py-2.5 px-4 text-right text-zinc-400 tabular-nums">{l.prompt_length}</td>
                    <td className="py-2.5 px-4 text-right text-zinc-400 tabular-nums">{l.response_length}</td>
                    <td className="py-2.5 px-4 text-right text-zinc-400 tabular-nums">{l.latency_ms?.toFixed(0)} ms</td>
                    <td className="py-2.5 px-4 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
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
              <tr className="text-zinc-600 border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Time</th>
                <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">SQL</th>
                <th className="text-right py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Rows</th>
                <th className="text-right py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-[10px] uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {queryLogs.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-4 text-zinc-400">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-2.5 px-4 font-mono text-zinc-300 truncate max-w-[300px]">{l.sql}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400 tabular-nums">{l.rows_returned ?? "-"}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400 tabular-nums">{l.duration_ms?.toFixed(0)} ms</td>
                  <td className="py-2.5 px-4 text-red-400 truncate max-w-[200px]">{l.error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cache" && (
        <div className="glass-card p-5 space-y-3">
          {Object.entries(cacheStats).map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-sm py-1">
              <span className="text-zinc-500">{k}</span>
              <span className="text-zinc-200 font-medium tabular-nums">{v}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={async () => {
                await api.clearCache();
                refresh();
                toast("success", "Cache cleared");
              }}
              className="btn-danger text-xs"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
