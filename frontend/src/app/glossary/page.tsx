"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpenIcon } from "@heroicons/react/24/outline";

import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import type { GlossaryTerm } from "@/types";

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
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

  const filtered = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.sql_expression.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Business Glossary</h2>
          <p className="text-sm text-gray-400">Map business terms to SQL expressions for better query understanding.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Term
        </button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Glossary Term">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder='Term (e.g. "revenue")'
            value={form.term}
            onChange={(e) => setForm({ ...form, term: e.target.value })}
            className="input-glass w-full"
            required
          />
          <input
            placeholder="SQL Expression (e.g. SUM(amount) WHERE status='completed')"
            value={form.sql_expression}
            onChange={(e) => setForm({ ...form, sql_expression: e.target.value })}
            className="input-glass w-full"
            required
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-glass w-full"
          />
          <button type="submit" className="btn-primary">Save</button>
        </form>
      </Modal>

      {terms.length > 0 && (
        <input
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass w-full mb-4"
        />
      )}

      {terms.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon className="w-12 h-12" />}
          title="No glossary terms defined"
          description="Add business terms mapped to SQL for smarter queries."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Add Term</button>}
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase">Term</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase">SQL Expression</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase">Description</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id} className={`border-b border-gray-800 ${i % 2 === 1 ? "bg-gray-800/20" : ""}`}>
                  <td className="py-2.5 px-4 font-medium">{t.term}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-gray-400">{t.sql_expression}</td>
                  <td className="py-2.5 px-4 text-gray-500 text-xs">{t.description || "-"}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={async () => { await api.deleteGlossaryTerm(t.id); refresh(); }}
                      className="px-2 py-1 text-xs bg-red-900/60 text-red-300 rounded-lg hover:bg-red-800/60 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
