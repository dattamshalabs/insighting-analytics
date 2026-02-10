"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CodeBracketIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export function ThoughtProcess({
  sql,
  code,
}: {
  sql?: string;
  code?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!sql && !code) return null;

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs
          bg-cyan-500/5 border border-cyan-500/10 text-cyan-400
          hover:bg-cyan-500/10 hover:border-cyan-500/20
          transition-all"
      >
        <CodeBracketIcon className="w-3.5 h-3.5" />
        <span>{open ? "Hide SQL & Code" : "View SQL Query"}</span>
        <ChevronDownIcon
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3">
              {sql && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                      SQL Query
                    </span>
                    <button
                      onClick={() => copyToClipboard(sql, setCopiedSql)}
                      className="btn-icon p-1"
                      title="Copy SQL"
                    >
                      {copiedSql ? (
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <pre className="code-block text-xs leading-relaxed">
                    <code>{sql}</code>
                  </pre>
                </div>
              )}
              {code && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                      Generated Code
                    </span>
                    <button
                      onClick={() => copyToClipboard(code, setCopiedCode)}
                      className="btn-icon p-1"
                      title="Copy Code"
                    >
                      {copiedCode ? (
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <pre className="code-block text-xs leading-relaxed">
                    <code>{code}</code>
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
