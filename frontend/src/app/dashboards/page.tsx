"use client";

import { useState, useCallback, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChartBarSquareIcon,
  SparklesIcon,
  PlusIcon,
  ArrowPathIcon,
  TableCellsIcon,
  PresentationChartBarIcon,
  ArrowTrendingUpIcon,
  TrashIcon,
  EnvelopeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { DashboardResponse } from "@/lib/api";
import type { Datasource } from "@/types";

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#18181b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "#71717a" },
};

interface WidgetData {
  label?: string;
  value?: number | string;
  change?: number;
  period?: string;
  text?: string;
  headers?: string[];
  rows?: unknown[][];
  [key: string]: unknown;
}

function KPICard({ widget }: { widget: DashboardResponse["widgets"][0] }) {
  const data = widget.data as WidgetData | null;
  const value = data?.value ?? "\u2014";
  const change = typeof data?.change === "number" ? data.change : null;

  return (
    <div className="glass-card p-5">
      <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider">{widget.title}</p>
      <p className="text-3xl font-bold text-zinc-100 mt-2 tabular-nums">{String(value)}</p>
      {change != null && (
        <p className={`text-sm mt-1 flex items-center gap-1 ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          <ArrowTrendingUpIcon className={`w-4 h-4 ${change < 0 ? "rotate-180" : ""}`} />
          {change >= 0 ? "+" : ""}{change}%
          {data?.period && <span className="text-zinc-600 ml-1">{data.period}</span>}
        </p>
      )}
    </div>
  );
}

function ChartWidget({ widget }: { widget: DashboardResponse["widgets"][0] }) {
  const data = (Array.isArray(widget.data) ? widget.data : []) as Record<string, string | number>[];
  const labelKey = (widget.config?.labelKey as string) || "label";
  const valueKeys = (widget.config?.valueKeys as string[]) || ["value"];
  const type = widget.type;

  if (!data.length) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">{widget.title}</h3>
        <p className="text-xs text-zinc-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">{widget.title}</h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <Tooltip {...tooltipStyle} />
              {valueKeys.map((k, i) => (
                <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <Tooltip {...tooltipStyle} />
              {valueKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <defs>
                {valueKeys.map((k, i) => (
                  <linearGradient key={k} id={`dg-${widget.id}-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={labelKey} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <Tooltip {...tooltipStyle} />
              {valueKeys.map((k, i) => (
                <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#dg-${widget.id}-${k})`} strokeWidth={2} />
              ))}
            </AreaChart>
          ) : (
            <PieChart>
              <Tooltip {...tooltipStyle} />
              <Pie
                data={data.map((r) => ({ name: String(r[labelKey]), value: Number(r[valueKeys[0]]) }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={35}
                strokeWidth={0}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                fontSize={10}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TableWidget({ widget }: { widget: DashboardResponse["widgets"][0] }) {
  const data = widget.data as WidgetData | null;
  const headers = data?.headers || [];
  const rows = data?.rows || [];

  return (
    <div className="glass-card p-5 col-span-full">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">{widget.title}</h3>
      <div className="overflow-auto max-h-60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-zinc-500 uppercase tracking-wider font-medium">{String(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                {(row as unknown[]).map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-zinc-300 tabular-nums">{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Lightweight Markdown Renderer ---------- */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (listItems) {
      if (listItems.type === "ul") {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 text-zinc-400">
            {listItems.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 text-zinc-400">
            {listItems.items.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        );
      }
      listItems = null;
    }
  };

  const formatInline = (s: string): React.ReactNode => {
    // Process **bold** and *italic*
    const parts: React.ReactNode[] = [];
    let remaining = s;
    let key = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic
      const italicMatch = remaining.match(/\*(.+?)\*/);

      const match = boldMatch && italicMatch
        ? (boldMatch.index! <= italicMatch.index! ? boldMatch : italicMatch)
        : boldMatch || italicMatch;

      if (!match || match.index === undefined) {
        parts.push(remaining);
        break;
      }

      if (match.index > 0) {
        parts.push(remaining.slice(0, match.index));
      }

      if (match[0].startsWith("**")) {
        parts.push(<strong key={key++} className="text-zinc-200 font-semibold">{match[1]}</strong>);
      } else {
        parts.push(<em key={key++} className="text-zinc-300 italic">{match[1]}</em>);
      }

      remaining = remaining.slice(match.index + match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="text-sm font-semibold text-zinc-200 mt-4 mb-1">
          {formatInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-zinc-100 mt-4 mb-2 border-b border-white/[0.06] pb-1">
          {formatInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold text-zinc-100 mt-4 mb-2">
          {formatInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!listItems || listItems.type !== "ul") {
        flushList();
        listItems = { type: "ul", items: [] };
      }
      listItems.items.push(formatInline(trimmed.slice(2)));
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (!listItems || listItems.type !== "ol") {
        flushList();
        listItems = { type: "ol", items: [] };
      }
      listItems.items.push(formatInline(olMatch[2]));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs text-zinc-400 leading-relaxed my-1">
        {formatInline(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}

function InsightCard({ widget }: { widget: DashboardResponse["widgets"][0] }) {
  const data = widget.data as WidgetData | null;
  const text = data?.text || "";

  return (
    <div className="glass-card p-6 col-span-full">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/10 shrink-0">
          <SparklesIcon className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">{widget.title}</h3>
          <div className="prose-insight">{renderMarkdown(text)}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardGrid({ dashboard }: { dashboard: DashboardResponse }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {dashboard.widgets.map((widget) => {
        if (widget.type === "kpi") return <KPICard key={widget.id} widget={widget} />;
        if (widget.type === "insight") return <InsightCard key={widget.id} widget={widget} />;
        if (widget.type === "table") return <TableWidget key={widget.id} widget={widget} />;
        return <ChartWidget key={widget.id} widget={widget} />;
      })}
    </div>
  );
}

/* ---------- Email Modal ---------- */
function EmailModal({
  open,
  onClose,
  dashboardId,
  dashboardTitle,
}: {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardTitle: string;
}) {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    const emails = recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast("error", "Enter at least one recipient email");
      return;
    }
    setSending(true);
    try {
      await api.sendDashboardEmail(dashboardId, emails, subject || undefined);
      toast("success", "Email sent successfully");
      onClose();
      setRecipients("");
      setSubject("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send email";
      toast("error", msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email Dashboard"
      description={`Send "${dashboardTitle}" via email`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Recipients (comma-separated)
          </label>
          <input
            type="text"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="john@example.com, jane@example.com"
            className="input-glass"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Subject (optional)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Dashboard Report: ${dashboardTitle}`}
            className="input-glass"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost text-xs py-1.5">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!recipients.trim() || sending}
            className="btn-primary flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <EnvelopeIcon className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardResponse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [selectedDs, setSelectedDs] = useState("");
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [emailTarget, setEmailTarget] = useState<DashboardResponse | null>(null);
  const { toast } = useToast();

  const loadDashboards = useCallback(async () => {
    try {
      const data = await api.getDashboards();
      setDashboards(data);
    } catch {
      // ignore on initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboards();
    api.getDatasources().then(setDatasources).catch(() => {});
  }, [loadDashboards]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);

    try {
      const dashboard = await api.generateDashboard(prompt, selectedDs || undefined);
      setDashboards((prev) => [dashboard, ...prev]);
      setActiveTabIdx(0); // Select the newly generated dashboard
      setShowCreate(false);
      setPrompt("");
      toast("success", "Dashboard generated");
    } catch {
      toast("error", "Failed to generate dashboard");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDashboard(id);
      setDashboards((prev) => {
        const next = prev.filter((d) => d.id !== id);
        // Adjust active tab if needed
        if (activeTabIdx >= next.length && next.length > 0) {
          setActiveTabIdx(next.length - 1);
        } else if (next.length === 0) {
          setActiveTabIdx(0);
        }
        return next;
      });
      toast("success", "Dashboard deleted");
    } catch {
      toast("error", "Failed to delete dashboard");
    }
  };

  const activeDashboard = dashboards[activeTabIdx] ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Dashboards</h2>
          <p className="text-sm text-zinc-600 mt-0.5">
            Auto-generate dashboards from your data with AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboards}
            className="btn-ghost p-2"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <SparklesIcon className="w-4 h-4" />
            Generate Dashboard
          </button>
        </div>
      </div>

      {/* Create Dashboard Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate Dashboard"
        description="Describe what you want to see and AI will create it"
        size="lg"
      >
        <div className="space-y-4">
          {datasources.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Datasource</label>
              <select
                value={selectedDs}
                onChange={(e) => setSelectedDs(e.target.value)}
                className="input-glass"
              >
                <option value="">All datasources</option>
                {datasources.map((ds) => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.db_type})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              What dashboard do you want?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Monthly sales dashboard with revenue, MoM change, product categories, and regional comparison"
              className="input-glass h-28 resize-none"
            />
          </div>

          {/* Quick templates */}
          <div>
            <p className="text-xs text-zinc-600 mb-2">Quick templates:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Sales overview with KPIs and trends",
                "Customer segmentation analysis",
                "Revenue by product category",
                "Monthly performance report",
              ].map((tmpl) => (
                <button
                  key={tmpl}
                  onClick={() => setPrompt(tmpl)}
                  className="px-3 py-1.5 text-xs bg-surface-300/50 border border-white/[0.06] rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12] transition-all"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Email Modal */}
      {emailTarget && (
        <EmailModal
          open={!!emailTarget}
          onClose={() => setEmailTarget(null)}
          dashboardId={emailTarget.id}
          dashboardTitle={emailTarget.title}
        />
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : dashboards.length === 0 ? (
        <EmptyState
          icon={<ChartBarSquareIcon className="w-10 h-10" />}
          title="No dashboards yet"
          description="Generate your first AI-powered dashboard from your connected datasets. Describe what you want to see and the AI will create charts, KPIs, and insights automatically."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
            >
              <SparklesIcon className="w-4 h-4" />
              Generate Dashboard
            </button>
          }
        />
      ) : (
        <div>
          {/* Tab Bar */}
          <div className="flex items-center border-b border-white/[0.06] mb-6 overflow-x-auto scrollbar-thin">
            {dashboards.map((dashboard, idx) => (
              <button
                key={dashboard.id}
                onClick={() => setActiveTabIdx(idx)}
                className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors shrink-0 ${
                  idx === activeTabIdx
                    ? "text-brand-400"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                <span className="truncate max-w-[180px]">{dashboard.title}</span>
                <span className="text-[10px] text-zinc-700">
                  {new Date(dashboard.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                {/* Delete button on tab */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(dashboard.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-all ml-1"
                  title="Delete"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
                {/* Active indicator */}
                {idx === activeTabIdx && (
                  <motion.span
                    layoutId="dashboard-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-500 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Active Dashboard Content */}
          {activeDashboard && (
            <motion.div
              key={activeDashboard.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Dashboard header with actions */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-200">{activeDashboard.title}</h3>
                  {activeDashboard.prompt && (
                    <p className="text-xs text-zinc-600 mt-0.5">{activeDashboard.prompt}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEmailTarget(activeDashboard)}
                    className="btn-ghost p-2 text-zinc-500 hover:text-brand-400"
                    title="Email dashboard"
                  >
                    <EnvelopeIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(activeDashboard.id)}
                    className="btn-ghost p-2 text-zinc-600 hover:text-red-400"
                    title="Delete dashboard"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <DashboardGrid dashboard={activeDashboard} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
