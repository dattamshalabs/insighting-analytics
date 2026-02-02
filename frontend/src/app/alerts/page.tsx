"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BellAlertIcon, ClipboardIcon } from "@heroicons/react/24/outline";

import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { api } from "@/lib/api";
import type { Alert } from "@/types";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Alerts</h2>
          <p className="text-sm text-gray-400">Run SQL queries on a schedule and trigger webhooks when conditions are met.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          New Alert
        </button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Alert">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Alert name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-glass w-full"
            required
          />
          <textarea
            placeholder="SQL Query"
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            className="input-glass w-full h-20 font-mono"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Cron (e.g. 0 9 * * *)"
              value={form.cron_expression}
              onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
              className="input-glass font-mono"
            />
            <input
              placeholder="Condition (e.g. result > 100)"
              value={form.threshold_condition}
              onChange={(e) => setForm({ ...form, threshold_condition: e.target.value })}
              className="input-glass font-mono"
            />
          </div>
          <input
            placeholder="Webhook URL (optional)"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            className="input-glass w-full"
          />
          <button type="submit" className="btn-primary">Create Alert</button>
        </form>
      </Modal>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<BellAlertIcon className="w-12 h-12" />}
          title="No alerts configured"
          description="Set up automated SQL queries that trigger when conditions are met."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">New Alert</button>}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className="glass-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{a.name}</span>
                    <ToggleSwitch
                      checked={a.enabled}
                      onChange={async (val) => { await api.updateAlert(a.id, { enabled: val }); refresh(); }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{a.cron_expression} | {a.threshold_condition}</p>
                  {a.last_triggered_at && (
                    <p className="text-xs text-yellow-400 mt-1">Triggered {timeAgo(a.last_triggered_at)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyQuery(a.query)}
                    className="btn-ghost text-xs py-1 px-2"
                    title="Copy SQL"
                  >
                    <ClipboardIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => { await api.deleteAlert(a.id); refresh(); }}
                    className="px-2 py-1 text-xs bg-red-900/60 text-red-300 rounded-xl hover:bg-red-800/60 transition-colors"
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
