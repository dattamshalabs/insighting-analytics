"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldExclamationIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import type { DataQualityReport } from "@/types";

const severityIcons = {
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const severityColors = {
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
};

export function DataQualityBanner({ report }: { report: DataQualityReport }) {
  const [expanded, setExpanded] = useState(false);

  if (!report.issues.length) return null;

  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");
  const score = report.overall_score;

  const scoreColor =
    score >= 0.9 ? "text-emerald-400" : score >= 0.7 ? "text-amber-400" : "text-red-400";
  const scoreBg =
    score >= 0.9 ? "bg-emerald-500" : score >= 0.7 ? "bg-amber-500" : "bg-red-500";

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl transition-all hover:bg-amber-500/8"
    >
      <div className="flex items-center gap-3">
        <ShieldExclamationIcon className="w-4.5 h-4.5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-amber-300">Data Quality</span>
            <div className="flex items-center gap-2">
              {/* Score bar */}
              <div className="w-16 h-1.5 bg-surface-400 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreBg}`}
                  style={{ width: `${score * 100}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium ${scoreColor}`}>
                {(score * 100).toFixed(0)}%
              </span>
            </div>
            {errors.length > 0 && (
              <span className="text-[10px] text-red-400">
                {errors.length} error{errors.length > 1 ? "s" : ""}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-[10px] text-amber-400">
                {warnings.length} warning{warnings.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
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
            <ul className="mt-3 space-y-1.5 border-t border-amber-500/10 pt-3">
              {report.issues.map((issue, i) => {
                const Icon = severityIcons[issue.severity] || InformationCircleIcon;
                const color = severityColors[issue.severity] || "text-zinc-400";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${color}`} />
                    <span className="text-xs text-zinc-400 leading-relaxed">
                      {issue.column && (
                        <span className="text-zinc-300 font-medium">{issue.column}: </span>
                      )}
                      {issue.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
