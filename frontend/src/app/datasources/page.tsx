"use client";

import { FormEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CircleStackIcon, ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

import { SchemaViewer } from "@/components/schema/SchemaViewer";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDatasources } from "@/hooks/useDatasources";
import { useSchemaMap } from "@/hooks/useSchemaMap";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { DatabaseType } from "@/types";

const DB_TYPES: { type: DatabaseType; label: string; icon: string; defaultPort: number; color: string; isFile?: boolean }[] = [
  { type: "postgresql", label: "PostgreSQL", icon: "P", defaultPort: 5432, color: "from-blue-500/20 to-blue-600/10" },
  { type: "mysql", label: "MySQL", icon: "M", defaultPort: 3306, color: "from-orange-500/20 to-orange-600/10" },
  { type: "mssql", label: "SQL Server", icon: "S", defaultPort: 1433, color: "from-red-500/20 to-red-600/10" },
  { type: "databricks", label: "Databricks", icon: "D", defaultPort: 443, color: "from-emerald-500/20 to-emerald-600/10" },
  { type: "csv", label: "CSV File", icon: "C", defaultPort: 0, color: "from-teal-500/20 to-teal-600/10", isFile: true },
  { type: "excel", label: "Excel File", icon: "X", defaultPort: 0, color: "from-green-500/20 to-green-600/10", isFile: true },
];

export default function DatasourcesPage() {
  const { datasources, loading, create, remove } = useDatasources();
  const { schema, loading: schemaLoading, load: loadSchema } = useSchemaMap();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [schemaModal, setSchemaModal] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [selectedDbType, setSelectedDbType] = useState<DatabaseType>("postgresql");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl_mode: "disable",
    is_default: false,
    http_path: "",
    catalog: "",
    access_token: "",
  });

  const handleDbTypeChange = (type: DatabaseType) => {
    setSelectedDbType(type);
    const config = DB_TYPES.find((d) => d.type === type);
    setForm((prev) => ({ ...prev, port: config?.defaultPort ?? 5432 }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // File upload for CSV/Excel
    if ((selectedDbType === "csv" || selectedDbType === "excel") && uploadFile) {
      try {
        await api.uploadDatasource(uploadFile, form.name || undefined);
        setShowForm(false);
        setUploadFile(null);
        setForm({
          name: "", host: "", port: 5432, database: "", username: "",
          password: "", ssl_mode: "disable", is_default: false,
          http_path: "", catalog: "", access_token: "",
        });
        toast("success", "File uploaded successfully");
        // Trigger a refresh of datasource list
        window.location.reload();
        return;
      } catch {
        toast("error", "Failed to upload file");
        return;
      }
    }

    await create({
      ...form,
      db_type: selectedDbType,
      http_path: selectedDbType === "databricks" ? form.http_path : undefined,
      catalog: selectedDbType === "databricks" ? form.catalog : undefined,
      access_token: selectedDbType === "databricks" ? form.access_token : undefined,
    });
    setShowForm(false);
    setForm({
      name: "", host: "", port: 5432, database: "", username: "",
      password: "", ssl_mode: "disable", is_default: false,
      http_path: "", catalog: "", access_token: "",
    });
    toast("success", "Datasource connected successfully");
  };

  const handleViewSchema = (id: string) => {
    loadSchema(id);
    setSchemaModal(true);
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await api.refreshSchema(id);
      toast("success", "Schema refreshed");
    } catch {
      toast("error", "Failed to refresh schema");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    toast("info", "Datasource removed");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Datasources</h2>
          <p className="text-sm text-zinc-600 mt-0.5">Connect and manage your database connections</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <CircleStackIcon className="w-4 h-4" />
          Add Datasource
        </button>
      </div>

      {/* Add Datasource Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Connect Datasource"
        description="Choose your database type and enter connection details"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Database Type Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">Database Type</label>
            <div className="grid grid-cols-3 gap-2">
              {DB_TYPES.map((db) => (
                <button
                  key={db.type}
                  type="button"
                  onClick={() => handleDbTypeChange(db.type)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedDbType === db.type
                      ? "border-brand-500/40 bg-brand-500/10"
                      : "border-white/[0.06] bg-surface-200/50 hover:border-white/[0.12]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${db.color} flex items-center justify-center mx-auto mb-2`}>
                    <span className="text-sm font-bold text-zinc-200">{db.icon}</span>
                  </div>
                  <span className={`text-xs ${selectedDbType === db.type ? "text-brand-400 font-medium" : "text-zinc-400"}`}>
                    {db.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload (CSV/Excel) */}
          {(selectedDbType === "csv" || selectedDbType === "excel") ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Dataset Name</label>
                <input
                  placeholder="e.g., Sales Data Q4"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-glass"
                  required
                />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={selectedDbType === "csv" ? ".csv" : ".xlsx,.xls"}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-8 border-2 border-dashed rounded-xl transition-all text-center ${
                    uploadFile
                      ? "border-brand-500/30 bg-brand-500/5"
                      : "border-white/[0.08] hover:border-white/[0.15] bg-surface-200/30"
                  }`}
                >
                  <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{uploadFile.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {(uploadFile.size / 1024).toFixed(1)} KB - Click to change
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-zinc-400">
                        Click to upload {selectedDbType === "csv" ? ".csv" : ".xlsx"} file
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">Max 50MB</p>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Connection Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Connection Name</label>
                  <input
                    placeholder="e.g., Production DB"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-glass"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Host</label>
                  <input
                    placeholder={selectedDbType === "databricks" ? "adb-xxx.azuredatabricks.net" : "localhost"}
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="input-glass"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 5432 })}
                    className="input-glass"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Database</label>
                  <input
                    placeholder="database_name"
                    value={form.database}
                    onChange={(e) => setForm({ ...form, database: e.target.value })}
                    className="input-glass"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Username</label>
                  <input
                    placeholder="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="input-glass"
                    required
                  />
                </div>
                <div className={selectedDbType === "databricks" ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    {selectedDbType === "databricks" ? "Access Token" : "Password"}
                  </label>
                  <input
                    type="password"
                    placeholder={selectedDbType === "databricks" ? "dapi..." : "password"}
                    value={selectedDbType === "databricks" ? form.access_token : form.password}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [selectedDbType === "databricks" ? "access_token" : "password"]: e.target.value,
                      })
                    }
                    className="input-glass"
                    required
                  />
                </div>
                {selectedDbType !== "databricks" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">SSL Mode</label>
                    <select
                      value={form.ssl_mode}
                      onChange={(e) => setForm({ ...form, ssl_mode: e.target.value })}
                      className="input-glass"
                    >
                      <option value="disable">Disable</option>
                      <option value="require">Require</option>
                      <option value="verify-full">Verify Full</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Databricks-specific fields */}
          {selectedDbType === "databricks" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">HTTP Path</label>
                <input
                  placeholder="/sql/1.0/warehouses/xxx"
                  value={form.http_path}
                  onChange={(e) => setForm({ ...form, http_path: e.target.value })}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Catalog</label>
                <input
                  placeholder="main"
                  value={form.catalog}
                  onChange={(e) => setForm({ ...form, catalog: e.target.value })}
                  className="input-glass"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="text-sm flex items-center gap-2 text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="rounded border-zinc-600 bg-surface-300 text-brand-500 focus:ring-brand-500/20"
              />
              Set as default
            </label>
            <button type="submit" className="btn-primary">
              Connect
            </button>
          </div>
        </form>
      </Modal>

      {/* Schema Modal */}
      <Modal open={schemaModal} onClose={() => setSchemaModal(false)} title="Database Schema" size="lg">
        {schemaLoading ? (
          <div className="py-8 text-center text-zinc-500 text-sm">Loading schema...</div>
        ) : (
          schema && <SchemaViewer schema={schema} />
        )}
      </Modal>

      {/* Datasource List */}
      {loading ? (
        <div className="py-8 text-center text-zinc-500 text-sm">Loading...</div>
      ) : datasources.length === 0 ? (
        <EmptyState
          icon={<CircleStackIcon className="w-10 h-10" />}
          title="No datasources configured"
          description="Connect a PostgreSQL, MySQL, SQL Server, or Databricks database to start querying your data."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Add Datasource
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {datasources.map((ds, i) => (
            <motion.div
              key={ds.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-blue-400">
                    {(ds.db_type || "P")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-200">{ds.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {ds.is_default && <span className="badge-brand text-[10px]">default</span>}
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 font-mono truncate">
                    {ds.db_type === "csv" || ds.db_type === "excel"
                      ? ds.file_path || `${ds.db_type} file`
                      : `${ds.username}@${ds.host}:${ds.port}/${ds.database}`}
                  </p>
                  <span className="badge-neutral text-[10px] mt-1 inline-block">{ds.db_type || "postgresql"}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                <button
                  onClick={() => handleViewSchema(ds.id)}
                  className="btn-ghost text-xs py-1.5"
                >
                  Schema
                </button>
                <button
                  onClick={() => handleRefresh(ds.id)}
                  disabled={refreshingId === ds.id}
                  className="btn-ghost text-xs py-1.5 flex items-center gap-1"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshingId === ds.id ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={() => handleDelete(ds.id)}
                  className="btn-danger text-xs py-1.5 ml-auto"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
