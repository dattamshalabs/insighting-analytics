"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

import { ChartPanel } from "@/components/charts/ChartPanel";
import { ChartTypeSelector } from "@/components/charts/ChartTypeSelector";
import { parseTableFromText, detectChartType } from "@/lib/chartUtils";
import type { ChartType, ChartableData } from "@/lib/chartUtils";
import type { Message } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function DataTable({ data }: { data: ChartableData }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-600">
            {data.headers.map((h) => (
              <th key={h} className="text-left py-1.5 px-2 text-gray-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className={`border-b border-gray-700/50 ${i % 2 === 1 ? "bg-gray-800/30" : ""}`}>
              {data.headers.map((h) => (
                <td key={h} className="py-1.5 px-2 text-gray-200">
                  {typeof row[h] === "number" ? (row[h] as number).toLocaleString() : row[h]}
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

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [showChart, setShowChart] = useState(true);

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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/20"
            : "glass-card text-gray-100"
        }`}
      >
        {cleanContent && <p className="whitespace-pre-wrap">{cleanContent}</p>}

        {chartData && (
          <div className="mt-3 space-y-2">
            <DataTable data={chartData} />

            <div className="flex items-center gap-2">
              <ChartTypeSelector selected={activeChartType} onChange={setChartType} />
              <button
                onClick={() => setShowChart(!showChart)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors ml-auto px-2 py-1 rounded-lg hover:bg-gray-700/50"
              >
                {showChart ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                {showChart ? "Hide Chart" : "Visualize"}
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
          <img src={`${API_URL}${message.chart_url}`} alt="Chart" className="mt-3 rounded max-w-full" />
        )}

        {message.stats && (
          <div className="mt-2 p-2 bg-gray-700/50 rounded-lg text-xs">
            <span className="font-semibold">{message.stats.test_name}</span>
            {message.stats.p_value != null && (
              <span className="ml-2">p = {message.stats.p_value.toFixed(4)}</span>
            )}
            <p className="mt-1 text-gray-300">{message.stats.interpretation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
