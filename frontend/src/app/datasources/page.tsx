"use client";

import { FormEvent, useState } from "react";

import { SchemaViewer } from "@/components/schema/SchemaViewer";
import { useDatasources } from "@/hooks/useDatasources";
import { useSchemaMap } from "@/hooks/useSchemaMap";
import { api } from "@/lib/api";

export default function DatasourcesPage() {
  const { datasources, loading, create, remove } = useDatasources();
  const { schema, loading: schemaLoading, load: loadSchema } = useSchemaMap();
  const [showForm, setShowForm] = useState(false);
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

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Datasources</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
        >
          {showForm ? "Cancel" : "Add Datasource"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(["name", "host", "database", "username", "password"] as const).map((field) => (
              <input
                key={field}
                type={field === "password" ? "password" : "text"}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(form as Record<string, unknown>)[field] as string}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                required
              />
            ))}
            <input
              type="number"
              placeholder="Port"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 5432 })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={form.ssl_mode}
              onChange={(e) => setForm({ ...form, ssl_mode: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="disable">SSL: disable</option>
              <option value="require">SSL: require</option>
            </select>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              Default
            </label>
            <button type="submit" className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm">
              Connect
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : datasources.length === 0 ? (
        <p className="text-gray-500">No datasources configured. Add one to get started.</p>
      ) : (
        <div className="space-y-3">
          {datasources.map((ds) => (
            <div key={ds.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{ds.name}</span>
                  {ds.is_default && (
                    <span className="ml-2 text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">
                      default
                    </span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {ds.username}@{ds.host}:{ds.port}/{ds.database}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadSchema(ds.id)}
                    className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Schema
                  </button>
                  <button
                    onClick={() => api.refreshSchema(ds.id)}
                    className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => remove(ds.id)}
                    className="px-3 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {schema && (
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-3">Schema</h3>
          {schemaLoading ? <p className="text-gray-400">Loading schema...</p> : <SchemaViewer schema={schema} />}
        </div>
      )}
    </div>
  );
}
