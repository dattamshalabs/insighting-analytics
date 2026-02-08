"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartType, ChartableData } from "@/lib/chartUtils";
import { getChartColors } from "@/lib/chartUtils";

const COLORS = getChartColors();

export function ChartPanel({
  data,
  chartType,
}: {
  data: ChartableData;
  chartType: ChartType;
}) {
  const { rows, labelKey, valueKeys } = data;

  const commonProps = {
    data: rows,
    margin: { top: 12, right: 16, bottom: 4, left: 0 },
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "#18181b",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    },
    labelStyle: { color: "#a1a1aa", marginBottom: 4 },
  };

  return (
    <div className="w-full h-64 mt-2 rounded-xl bg-surface-200/30 border border-white/[0.04] p-3">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "bar" ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <Tooltip {...tooltipStyle} />
            {valueKeys.length > 1 && <Legend />}
            {valueKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <Tooltip {...tooltipStyle} />
            {valueKeys.length > 1 && <Legend />}
            {valueKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart {...commonProps}>
            <defs>
              {valueKeys.map((k, i) => (
                <linearGradient key={k} id={`gradient-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
            <Tooltip {...tooltipStyle} />
            {valueKeys.length > 1 && <Legend />}
            {valueKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={`url(#gradient-${k})`} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Pie
              data={rows.map((r) => ({ name: String(r[labelKey]), value: Number(r[valueKeys[0]]) }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={40}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: "#52525b" }}
              fontSize={11}
              strokeWidth={0}
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
