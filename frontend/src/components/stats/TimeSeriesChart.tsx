"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TimeSeriesChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (!data.length) return null;

  return (
    <div className="rounded-xl bg-surface-200/30 border border-white/[0.04] p-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: "#6366f1" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
