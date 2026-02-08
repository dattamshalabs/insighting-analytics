"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LightBulbIcon,
  ChevronDownIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import type { Message, Recommendation } from "@/types";

const priorityConfig = {
  high: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "High Priority",
  },
  medium: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Medium",
  },
  low: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    label: "Low",
  },
};

function RecommendationItem({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const config = priorityConfig[rec.priority] || priorityConfig.medium;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full text-left p-3 rounded-xl border ${config.border} ${config.bg} transition-all hover:brightness-110`}
    >
      <div className="flex items-start gap-3">
        <LightBulbIcon className={`w-4 h-4 shrink-0 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-zinc-200">{rec.action}</span>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${config.color}`}>
              {config.label}
            </span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{rec.rationale}</p>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-400">{rec.expected_impact}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-400">
                      {(rec.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-2 h-1 bg-surface-400 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      rec.confidence > 0.7
                        ? "bg-emerald-500"
                        : rec.confidence > 0.4
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${rec.confidence * 100}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </div>
    </button>
  );
}

interface RecommendationCardProps {
  message: Message;
  onFetchRecommendations: (messageId: string) => Promise<Recommendation[]>;
}

export function RecommendationCard({
  message,
  onFetchRecommendations,
}: RecommendationCardProps) {
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const hasRecs = message.recommendations.length > 0;

  const handleFetch = async () => {
    if (loading || fetched) return;
    setLoading(true);
    await onFetchRecommendations(message.id);
    setLoading(false);
    setFetched(true);
  };

  // If recommendations already exist (from history), show them directly
  if (hasRecs) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-medium text-zinc-500">Recommendations</span>
        </div>
        {message.recommendations.map((rec, i) => (
          <RecommendationItem key={i} rec={rec} />
        ))}
      </div>
    );
  }

  // Show prompt button for lazy loading
  if (!fetched) {
    return (
      <div className="mt-3">
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs
            bg-brand-500/5 border border-brand-500/10 text-brand-400
            hover:bg-brand-500/10 hover:border-brand-500/20
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
              <span>Generating recommendations...</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Get AI Recommendations</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return null;
}
