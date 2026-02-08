"use client";

import type { ChartType } from "@/lib/chartUtils";

const options: { type: ChartType; label: string }[] = [
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "pie", label: "Pie" },
];

export function ChartTypeSelector({
  selected,
  onChange,
}: {
  selected: ChartType;
  onChange: (t: ChartType) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-surface-300/50 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.type}
          onClick={() => onChange(o.type)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            selected === o.type
              ? "bg-brand-500 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          title={o.label}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
