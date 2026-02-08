import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      {icon && (
        <div className="text-zinc-700 mb-5 p-4 rounded-2xl bg-surface-200/50 border border-white/[0.04]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-300">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-600 mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
