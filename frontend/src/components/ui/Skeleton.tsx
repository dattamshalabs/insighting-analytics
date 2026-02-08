interface SkeletonProps {
  variant?: "lines" | "message";
  count?: number;
}

function SkeletonLine({ width }: { width: string }) {
  return <div className={`h-3 rounded-lg bg-white/[0.04] animate-shimmer ${width}`} />;
}

export function Skeleton({ variant = "lines", count = 3 }: SkeletonProps) {
  if (variant === "message") {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-xl p-4 space-y-2 ${i % 2 === 0 ? "bg-brand-500/10 w-48" : "glass-card w-72"}`}>
              <SkeletonLine width="w-full" />
              <SkeletonLine width="w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} width={i === count - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}
