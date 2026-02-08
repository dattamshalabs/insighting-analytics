"use client";

export function SignificanceBadge({ pValue }: { pValue: number }) {
  const significant = pValue < 0.05;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
        significant
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-surface-300 text-zinc-400 border-white/[0.06]"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${significant ? "bg-emerald-400" : "bg-zinc-500"}`} />
      p = {pValue.toFixed(4)} {significant ? "(significant)" : "(not significant)"}
    </span>
  );
}
