"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellAlertIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useToast } from "@/components/ui/Toast";
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();
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
    toast("success", "Alert created");
  };

  const copyQuery = (id: string, query: string) => {
    navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Scheduled Alerts</h2>
          <p className="text-sm text-zinc-600 mt-0.5">
            Run SQL queries on a schedule and trigger webhooks when conditions are met
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          New Alert
        </button>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create Alert"
        description="Define a SQL query and condition to monitor"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Alert Name</label>
            <input
              placeholder="e.g., High error rate"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-glass"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">SQL Query</label>
            <textarea
              placeholder="SELECT COUNT(*) FROM errors WHERE created_at > NOW() - INTERVAL '1 hour'"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              className="input-glass h-24 font-mono text-xs resize-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Cron Schedule</label>
              <input
                placeholder="0 9 * * *"
                value={form.cron_expression}
                onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
                className="input-glass font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Condition</label>
              <input
                placeholder="result > 100"
                value={form.threshold_condition}
                onChange={(e) => setForm({ ...form, threshold_condition: e.target.value })}
                className="input-glass font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Webhook URL (optional)</label>
            <input
              placeholder="https://hooks.slack.com/..."
              value={form.webhook_url}
              onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
              className="input-glass"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Create Alert</button>
          </div>
        </form>
      </Modal>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<BellAlertIcon className="w-10 h-10" />}
          title="No alerts configured"
          description="Set up automated SQL queries that trigger when conditions are met."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              New Alert
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-zinc-200">{a.name}</span>
                    <ToggleSwitch
                      checked={a.enabled}
                      onChange={async (val) => {
                        await api.updateAlert(a.id, { enabled: val });
                        refresh();
                        toast("info", val ? "Alert enabled" : "Alert disabled");
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="badge-neutral text-[10px] font-mono">{a.cron_expression}</span>
                    <span className="badge-neutral text-[10px] font-mono">{a.threshold_condition}</span>
                  </div>
                  {a.last_triggered_at && (
                    <p className="text-xs text-amber-400 mt-2">
                      Last triggered {timeAgo(a.last_triggered_at)}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => copyQuery(a.id, a.query)}
                    className="btn-icon p-2"
                    title="Copy SQL"
                  >
                    {copiedId === a.id ? (
                      <CheckIcon className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      await api.deleteAlert(a.id);
                      refresh();
                      toast("info", "Alert deleted");
                    }}
                    className="btn-danger text-xs py-1.5 px-3"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
