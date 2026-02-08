"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { SchemaMap } from "@/types";

export function SchemaViewer({ schema }: { schema: SchemaMap }) {
  const [expandedTable, setExpandedTable] = useState<string | null>(
    schema.tables[0]?.name ?? null
  );

  return (
    <div className="space-y-3">
      {schema.tables.map((table) => {
        const isExpanded = expandedTable === table.name;
        return (
          <div
            key={table.name}
            className="bg-surface-200/50 border border-white/[0.06] rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpandedTable(isExpanded ? null : table.name)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-zinc-200">{table.name}</span>
                <span className="badge-neutral text-[10px]">{table.columns.length} cols</span>
              </div>
              <div className="flex items-center gap-2">
                {table.row_count != null && (
                  <span className="text-[10px] text-zinc-600 tabular-nums">
                    ~{table.row_count.toLocaleString()} rows
                  </span>
                )}
                <ChevronDownIcon className={`w-4 h-4 text-zinc-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-white/[0.04]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-600 border-b border-white/[0.04]">
                      <th className="text-left py-2 px-4 font-medium text-[10px] uppercase tracking-wider">Column</th>
                      <th className="text-left py-2 px-4 font-medium text-[10px] uppercase tracking-wider">Type</th>
                      <th className="text-left py-2 px-4 font-medium text-[10px] uppercase tracking-wider">Keys</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((col) => (
                      <tr key={col.name} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-4 text-zinc-300 font-mono">{col.name}</td>
                        <td className="py-2 px-4 text-zinc-500">{col.data_type}</td>
                        <td className="py-2 px-4">
                          {col.is_primary_key && (
                            <span className="badge-warning text-[9px] mr-1">PK</span>
                          )}
                          {col.is_foreign_key && (
                            <span className="badge-brand text-[9px]" title={col.references}>FK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {schema.relations.length > 0 && (
        <div className="bg-surface-200/50 border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Relationships</h3>
          <ul className="space-y-1.5">
            {schema.relations.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-zinc-300 font-mono">{r.from_table}.{r.from_column}</span>
                <span className="text-zinc-600">-&gt;</span>
                <span className="text-zinc-300 font-mono">{r.to_table}.{r.to_column}</span>
                <span
                  className={`text-[10px] ${
                    r.relation_type === "explicit" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  ({r.relation_type} {(r.confidence * 100).toFixed(0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
