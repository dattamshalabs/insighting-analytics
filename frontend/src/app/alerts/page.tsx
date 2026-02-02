"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Alert } from "@/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    query: "",
    cron_expression: "0 9 * * *",
    threshold_condition: "result > 0",
    webhook_url: "",
    enabled: true,
  });

  const refresh = useCallback(async () => {
    setAlerts(await api.getAlerts());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createAlert({
      ...form,
      webhook_url: form.webhook_url || undefined,
    });
    setForm({ name: "", query: "", cron_expression: "0 9 * * *", threshold_condition: "result > 0", webhook_url: "", enabled: true });
    setShowForm(false);
    refresh();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Alerts</h2>
          <p className="text-sm text-gray-400">Run SQL queries on a schedule and trigger webhooks when conditions are met.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
        >
          {showForm ? "Cancel" : "New Alert"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <input
            placeholder="Alert name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            required
          />
          <textarea
            placeholder="SQL Query"
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm h-20 font-mono"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Cron (e.g. 0 9 * * *)"
              value={form.cron_expression}
              onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
            />
            <input
              placeholder="Condition (e.g. result > 100)"
              value={form.threshold_condition}
              onChange={(e) => setForm({ ...form, threshold_condition: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
            />
          </div>
          <input
            placeholder="Webhook URL (optional)"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded text-sm">
            Create Alert
          </button>
        </form>
      )}

      {alerts.length === 0 ? (
        <p className="text-gray-500">No alerts configured.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{a.name}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${a.enabled ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                    {a.enabled ? "active" : "disabled"}
                  </span>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{a.cron_expression} | {a.threshold_condition}</p>
                  {a.last_triggered_at && (
                    <p className="text-xs text-yellow-400 mt-1">Last triggered: {new Date(a.last_triggered_at).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => { await api.updateAlert(a.id, { enabled: !a.enabled }); refresh(); }}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    {a.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={async () => { await api.deleteAlert(a.id); refresh(); }}
                    className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
