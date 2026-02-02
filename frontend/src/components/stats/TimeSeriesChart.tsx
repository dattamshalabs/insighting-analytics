"use client";

// Lightweight time-series chart using SVG (no external charting lib)
export function TimeSeriesChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const w = 600;
  const h = 200;
  const padding = 30;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (w - 2 * padding);
      const y = h - padding - ((d.value - min) / range) * (h - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px]">
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * (w - 2 * padding);
          const y = h - padding - ((d.value - min) / range) * (h - 2 * padding);
          return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
        })}
      </svg>
    </div>
  );
}
