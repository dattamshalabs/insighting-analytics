"use client";

import { FormEvent, useState } from "react";
import { CircleStackIcon } from "@heroicons/react/24/outline";

import { SchemaViewer } from "@/components/schema/SchemaViewer";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDatasources } from "@/hooks/useDatasources";
import { useSchemaMap } from "@/hooks/useSchemaMap";
import { api } from "@/lib/api";

export default function DatasourcesPage() {
  const { datasources, loading, create, remove } = useDatasources();
  const { schema, loading: schemaLoading, load: loadSchema } = useSchemaMap();
  const [showForm, setShowForm] = useState(false);
  const [schemaModal, setSchemaModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl_mode: "disable",
    is_default: false,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await create(form);
    setShowForm(false);
    setForm({ name: "", host: "", port: 5432, database: "", username: "", password: "", ssl_mode: "disable", is_default: false });
  };

  const handleViewSchema = (id: string) => {
    loadSchema(id);
    setSchemaModal(true);
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Datasources</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Datasource
        </button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Datasource">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(["name", "host", "database", "username", "password"] as const).map((field) => (
              <input
                key={field}
                type={field === "password" ? "password" : "text"}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(form as Record<string, unknown>)[field] as string}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="input-glass"
                required
              />
            ))}
            <input
              type="number"
              placeholder="Port"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 5432 })}
              className="input-glass"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={form.ssl_mode}
              onChange={(e) => setForm({ ...form, ssl_mode: e.target.value })}
              className="input-glass"
            >
              <option value="disable">SSL: disable</option>
              <option value="require">SSL: require</option>
            </select>
            <label className="text-sm flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              Default
            </label>
            <button type="submit" className="btn-primary ml-auto">Connect</button>
          </div>
        </form>
      </Modal>

      <Modal open={schemaModal} onClose={() => setSchemaModal(false)} title="Schema">
        {schemaLoading ? <p className="text-gray-400">Loading schema...</p> : schema && <SchemaViewer schema={schema} />}
      </Modal>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : datasources.length === 0 ? (
        <EmptyState
          icon={<CircleStackIcon className="w-12 h-12" />}
          title="No datasources configured"
          description="Add a PostgreSQL connection to start querying your data."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Add Datasource</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {datasources.map((ds) => (
            <div key={ds.id} className="glass-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{ds.name}</span>
                    {ds.is_default && (
                      <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full">default</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    {ds.username}@{ds.host}:{ds.port}/{ds.database}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleViewSchema(ds.id)} className="btn-ghost text-xs py-1">Schema</button>
                <button onClick={() => api.refreshSchema(ds.id)} className="btn-ghost text-xs py-1">Refresh</button>
                <button onClick={() => remove(ds.id)} className="px-3 py-1 text-xs bg-red-900/60 text-red-300 rounded-xl hover:bg-red-800/60 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
