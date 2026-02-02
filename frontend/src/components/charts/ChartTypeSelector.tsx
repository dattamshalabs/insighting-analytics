"use client";

import type { ChartType } from "@/lib/chartUtils";

const options: { type: ChartType; label: string; icon: string }[] = [
  { type: "bar", label: "Bar", icon: "▊" },
  { type: "line", label: "Line", icon: "╱" },
  { type: "area", label: "Area", icon: "▓" },
  { type: "pie", label: "Pie", icon: "◔" },
];

export function ChartTypeSelector({
  selected,
  onChange,
}: {
  selected: ChartType;
  onChange: (t: ChartType) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.type}
          onClick={() => onChange(o.type)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            selected === o.type
              ? "bg-blue-600 text-white"
              : "bg-gray-700/60 text-gray-400 hover:text-gray-200"
          }`}
          title={o.label}
        >
          <span className="mr-1">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
