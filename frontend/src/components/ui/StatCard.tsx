import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      {icon && (
        <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/10 text-brand-400 shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-zinc-600 font-medium">{label}</p>
        <p className="text-2xl font-bold text-zinc-100 tracking-tight mt-0.5 tabular-nums">
          {value}
        </p>
        {trend && (
          <p
            className={`text-xs mt-0.5 ${
              trend.value >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%{trend.label ? ` ${trend.label}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
