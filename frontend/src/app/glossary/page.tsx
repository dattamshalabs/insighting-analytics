"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { GlossaryTerm } from "@/types";

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ term: "", sql_expression: "", description: "" });

  const refresh = useCallback(async () => {
    setTerms(await api.getGlossary());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createGlossaryTerm(form);
    setForm({ term: "", sql_expression: "", description: "" });
    setShowForm(false);
    refresh();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Business Glossary</h2>
          <p className="text-sm text-gray-400">Map business terms to SQL expressions for better query understanding.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
        >
          {showForm ? "Cancel" : "Add Term"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <input
            placeholder='Term (e.g. "revenue")'
            value={form.term}
            onChange={(e) => setForm({ ...form, term: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="SQL Expression (e.g. SUM(amount) WHERE status='completed')"
            value={form.sql_expression}
            onChange={(e) => setForm({ ...form, sql_expression: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded text-sm">
            Save
          </button>
        </form>
      )}

      {terms.length === 0 ? (
        <p className="text-gray-500">No glossary terms defined yet.</p>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start justify-between">
              <div>
                <span className="font-medium">{t.term}</span>
                <p className="text-xs text-gray-400 mt-1 font-mono">{t.sql_expression}</p>
                {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
              </div>
              <button
                onClick={async () => { await api.deleteGlossaryTerm(t.id); refresh(); }}
                className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
