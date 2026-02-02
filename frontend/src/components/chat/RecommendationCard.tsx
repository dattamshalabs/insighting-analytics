"use client";

import type { Recommendation } from "@/types";

const priorityColors = {
  high: "border-red-600 bg-red-900/20",
  medium: "border-yellow-600 bg-yellow-900/20",
  low: "border-green-600 bg-green-900/20",
};

export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const color = priorityColors[recommendation.priority] || priorityColors.medium;

  return (
    <div className={`border rounded-lg p-3 text-sm ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{recommendation.action}</span>
        <span className="text-xs uppercase tracking-wide opacity-70">
          {recommendation.priority}
        </span>
      </div>
      <p className="text-gray-300 text-xs">{recommendation.rationale}</p>
      <p className="text-gray-400 text-xs mt-1">
        Impact: {recommendation.expected_impact} (confidence:{" "}
        {(recommendation.confidence * 100).toFixed(0)}%)
      </p>
    </div>
  );
}
