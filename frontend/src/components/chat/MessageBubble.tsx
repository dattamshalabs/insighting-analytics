"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon, UserIcon } from "@heroicons/react/24/solid";

import { ChartPanel } from "@/components/charts/ChartPanel";
import { ChartTypeSelector } from "@/components/charts/ChartTypeSelector";
import { parseTableFromText, detectChartType } from "@/lib/chartUtils";
import type { ChartType, ChartableData } from "@/lib/chartUtils";
import type { Message } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function DataTable({ data }: { data: ChartableData }) {
  return (
    <div className="overflow-x-auto mt-3 rounded-lg border border-white/[0.06]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] bg-surface-200/50">
            {data.headers.map((h) => (
              <th
                key={h}
                className="text-left py-2 px-3 text-zinc-500 font-medium uppercase tracking-wider text-[10px]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              {data.headers.map((h) => (
                <td key={h} className="py-2 px-3 text-zinc-300 tabular-nums">
                  {typeof row[h] === "number"
                    ? (row[h] as number).toLocaleString()
                    : String(row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function stripTableText(text: string): string {
  const lines = text.split("\n");
  let tableStart = -1;
  let tableEnd = lines.length;

  for (let i = 0; i < lines.length - 1; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (/^\d+\s/.test(trimmed)) continue;
    const nextNonBlank = lines.slice(i + 1).find((l) => l.trim().length > 0);
    if (nextNonBlank && /^\s*\d+\s/.test(nextNonBlank)) {
      tableStart = i;
      break;
    }
  }

  if (tableStart === -1) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith("|") && t.endsWith("|")) {
        tableStart = i;
        break;
      }
    }
  }

  if (tableStart === -1) return text;

  for (let i = tableStart + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^\[\d+ rows/.test(trimmed)) {
      tableEnd = i + 1;
      break;
    }
    if (tableStart >= 0 && lines[tableStart].trim().startsWith("|") && trimmed && !trimmed.startsWith("|")) {
      tableEnd = i;
      break;
    }
  }

  const before = lines.slice(0, tableStart).join("\n").trim();
  const after = lines.slice(tableEnd).join("\n").trim();
  return [before, after].filter(Boolean).join("\n\n");
}

interface MessageBubbleProps {
  message: Message;
  onFeedback?: (messageId: string, rating: "up" | "down") => void;
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showChart, setShowChart] = useState(true);
  const [copied, setCopied] = useState(false);

  const chartData = useMemo(() => {
    if (isUser) return null;
    return message.tabular_data ?? parseTableFromText(message.content);
  }, [isUser, message.content, message.tabular_data]);

  const cleanContent = useMemo(() => {
    if (!chartData || isUser) return message.content;
    return stripTableText(message.content);
  }, [chartData, isUser, message.content]);

  const [chartType, setChartType] = useState<ChartType | null>(null);
  const activeChartType = chartType ?? (chartData ? detectChartType(chartData) : "bar");

  const copyContent = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-xl rounded-2xl rounded-tr-md px-4 py-3 text-sm bg-brand-600 text-white shadow-lg shadow-brand-900/20">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-surface-300 border border-white/[0.06] flex items-center justify-center shrink-0">
          <UserIcon className="w-4 h-4 text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <SparklesIcon className="w-4 h-4 text-brand-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="glass-card px-4 py-3 text-sm">
          {cleanContent && (
            <p className="whitespace-pre-wrap text-zinc-200 leading-relaxed">{cleanContent}</p>
          )}

          {chartData && (
            <div className="mt-3 space-y-3">
              <DataTable data={chartData} />

              <div className="flex items-center gap-2">
                <ChartTypeSelector selected={activeChartType} onChange={setChartType} />
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors ml-auto px-2 py-1 rounded-lg hover:bg-white/[0.04]"
                >
                  {showChart ? (
                    <EyeSlashIcon className="w-3.5 h-3.5" />
                  ) : (
                    <EyeIcon className="w-3.5 h-3.5" />
                  )}
                  {showChart ? "Hide" : "Visualize"}
                </button>
              </div>

              <AnimatePresence>
                {showChart && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChartPanel data={chartData} chartType={activeChartType} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!chartData && message.chart_url && (
            <img
              src={`${API_URL}${message.chart_url}`}
              alt="Chart"
              className="mt-3 rounded-lg max-w-full border border-white/[0.06]"
            />
          )}

          {message.stats && (
            <div className="mt-3 p-3 bg-surface-200/50 border border-white/[0.06] rounded-lg text-xs">
              <span className="font-semibold text-zinc-200">{message.stats.test_name}</span>
              {message.stats.p_value != null && (
                <span className={`ml-2 ${message.stats.p_value < 0.05 ? "text-emerald-400" : "text-zinc-400"}`}>
                  p = {message.stats.p_value.toFixed(4)}
                </span>
              )}
              <p className="mt-1.5 text-zinc-400 leading-relaxed">{message.stats.interpretation}</p>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 mt-1.5 ml-1">
          <button
            onClick={copyContent}
            className="btn-icon p-1.5"
            title="Copy response"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            )}
          </button>
          {onFeedback && (
            <>
              <button
                onClick={() => onFeedback(message.id, "up")}
                className={`btn-icon p-1.5 ${message.feedback === "up" ? "text-emerald-400 bg-emerald-500/10" : ""}`}
                title="Helpful"
              >
                <HandThumbUpIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onFeedback(message.id, "down")}
                className={`btn-icon p-1.5 ${message.feedback === "down" ? "text-red-400 bg-red-500/10" : ""}`}
                title="Not helpful"
              >
                <HandThumbDownIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <span className="text-[10px] text-zinc-700 ml-auto">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
