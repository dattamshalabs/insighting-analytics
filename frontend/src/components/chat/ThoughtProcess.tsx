"use client";

import { useState } from "react";

export function ThoughtProcess({
  sql,
  code,
}: {
  sql?: string;
  code?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!sql && !code) return null;

  return (
    <div className="ml-12 mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-300"
      >
        {open ? "Hide" : "Show"} thought process
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sql && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">SQL</span>
              <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs overflow-x-auto">
                {sql}
              </pre>
            </div>
          )}
          {code && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Code</span>
              <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs overflow-x-auto">
                {code}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
