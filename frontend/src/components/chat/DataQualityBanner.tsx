"use client";

import type { DataQualityReport } from "@/types";

export function DataQualityBanner({ report }: { report: DataQualityReport }) {
  if (!report.issues.length) return null;

  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  return (
    <div className="ml-12 mt-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-yellow-300">Data Quality</span>
        <span className="text-xs text-gray-400">
          Score: {(report.overall_score * 100).toFixed(0)}%
        </span>
      </div>
      <ul className="space-y-1 text-xs">
        {errors.map((issue, i) => (
          <li key={`e-${i}`} className="text-red-400">
            {issue.message}
          </li>
        ))}
        {warnings.map((issue, i) => (
          <li key={`w-${i}`} className="text-yellow-400">
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
