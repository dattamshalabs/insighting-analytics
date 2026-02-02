"use client";

import type { SchemaMap } from "@/types";

export function SchemaViewer({ schema }: { schema: SchemaMap }) {
  return (
    <div className="space-y-4">
      {schema.tables.map((table) => (
        <div
          key={table.name}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{table.name}</h3>
            {table.row_count != null && (
              <span className="text-xs text-gray-400">
                ~{table.row_count.toLocaleString()} rows
              </span>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-1">Column</th>
                <th className="text-left py-1">Type</th>
                <th className="text-left py-1">Keys</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name} className="border-b border-gray-800">
                  <td className="py-1">{col.name}</td>
                  <td className="py-1 text-gray-400">{col.data_type}</td>
                  <td className="py-1">
                    {col.is_primary_key && (
                      <span className="text-yellow-400 mr-1">PK</span>
                    )}
                    {col.is_foreign_key && (
                      <span className="text-blue-400" title={col.references}>
                        FK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {schema.relations.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">Relationships</h3>
          <ul className="text-xs space-y-1">
            {schema.relations.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>
                  {r.from_table}.{r.from_column}
                </span>
                <span className="text-gray-500">-&gt;</span>
                <span>
                  {r.to_table}.{r.to_column}
                </span>
                <span
                  className={`text-xs ${
                    r.relation_type === "explicit"
                      ? "text-green-400"
                      : "text-yellow-400"
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
