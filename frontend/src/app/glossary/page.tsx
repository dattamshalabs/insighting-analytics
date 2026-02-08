"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpenIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { GlossaryTerm } from "@/types";

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ term: "", sql_expression: "", description: "" });
  const { toast } = useToast();

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
    toast("success", "Term added to glossary");
  };

  const handleDelete = async (id: string) => {
    await api.deleteGlossaryTerm(id);
    refresh();
    toast("info", "Term removed");
  };

  const filtered = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.sql_expression.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Business Glossary</h2>
          <p className="text-sm text-zinc-600 mt-0.5">
            Map business terms to SQL expressions for better query understanding
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Term
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Glossary Term"
        description="Define a business term and its SQL equivalent"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Term</label>
            <input
              placeholder='e.g., "revenue"'
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              className="input-glass"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">SQL Expression</label>
            <input
              placeholder="e.g., SUM(amount) WHERE status='completed'"
              value={form.sql_expression}
              onChange={(e) => setForm({ ...form, sql_expression: e.target.value })}
              className="input-glass font-mono text-xs"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Description</label>
            <input
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-glass"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Save Term</button>
          </div>
        </form>
      </Modal>

      {terms.length > 0 && (
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Search terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass pl-9"
          />
        </div>
      )}

      {terms.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon className="w-10 h-10" />}
          title="No glossary terms defined"
          description="Add business terms mapped to SQL for smarter queries."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Add Term
            </button>
          }
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-zinc-600 font-medium text-[10px] uppercase tracking-wider">Term</th>
                <th className="text-left py-3 px-4 text-zinc-600 font-medium text-[10px] uppercase tracking-wider">SQL Expression</th>
                <th className="text-left py-3 px-4 text-zinc-600 font-medium text-[10px] uppercase tracking-wider">Description</th>
                <th className="py-3 px-4 w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-zinc-200">{t.term}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{t.sql_expression}</td>
                  <td className="py-3 px-4 text-zinc-600 text-xs">{t.description || "-"}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="btn-danger text-xs py-1 px-2"
                    >
                      Delete
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
