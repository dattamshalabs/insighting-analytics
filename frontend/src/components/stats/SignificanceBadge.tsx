"use client";

export function SignificanceBadge({ pValue }: { pValue: number }) {
  const significant = pValue < 0.05;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        significant
          ? "bg-green-900/50 text-green-300 border border-green-700"
          : "bg-gray-800 text-gray-400 border border-gray-700"
      }`}
    >
      p = {pValue.toFixed(4)} {significant ? "(significant)" : "(not significant)"}
    </span>
  );
}
