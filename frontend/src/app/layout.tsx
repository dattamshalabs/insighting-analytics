"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  BookOpenIcon,
  BellAlertIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ArrowRightOnRectangleIcon,
  ChartBarSquareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const navItems = [
  { href: "/", label: "Chat", Icon: ChatBubbleLeftRightIcon, description: "Query your data" },
  { href: "/dashboards", label: "Dashboards", Icon: ChartBarSquareIcon, description: "Auto-generated insights" },
  { href: "/datasources", label: "Datasources", Icon: CircleStackIcon, description: "Manage connections" },
  { href: "/glossary", label: "Glossary", Icon: BookOpenIcon, description: "Business terms" },
  { href: "/alerts", label: "Alerts", Icon: BellAlertIcon, description: "Scheduled queries" },
  { href: "/admin", label: "Admin", Icon: Cog6ToothIcon, description: "Logs & cache" },
];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated && pathname !== "/login") return null;
  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        router.push("/");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Could open a command palette in the future
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  if (pathname === "/login" || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Navigation Sidebar */}
      <nav
        className={`${
          collapsed ? "w-[68px]" : "w-60"
        } glass flex flex-col shrink-0 transition-all duration-300 ease-out`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0 shadow-glow-sm">
                <SparklesIcon className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gradient tracking-tight leading-tight">
                  Insighting
                </h1>
                <p className="text-[10px] text-zinc-600 leading-tight">Analytics Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center mx-auto shadow-glow-sm">
              <SparklesIcon className="w-4.5 h-4.5 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] rounded-lg transition-all"
          >
            <ChevronLeftIcon
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 divider" />

        {/* Nav Items */}
        <div className="flex flex-col gap-0.5 flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
          {navItems.map(({ href, label, Icon, description }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  active
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-500 rounded-r-full" />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  active ? "text-brand-400" : "text-zinc-600 group-hover:text-zinc-400"
                }`} />
                {!collapsed && (
                  <div className="min-w-0">
                    <span className={`block text-[13px] leading-tight ${active ? "font-medium" : ""}`}>
                      {label}
                    </span>
                    {!active && (
                      <span className="block text-[10px] text-zinc-700 leading-tight mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {description}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="px-3 pb-3 mt-auto">
          <div className="divider mb-3" />
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400 transition-all ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Logout" : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="text-[13px]">Logout</span>}
          </button>

          {/* Keyboard shortcut hint */}
          {!collapsed && (
            <div className="mt-2 px-3 py-2 text-[10px] text-zinc-700 space-y-0.5">
              <div className="flex justify-between">
                <span>New Chat</span>
                <kbd className="text-zinc-600 bg-surface-300 px-1 rounded text-[9px]">Cmd+N</kbd>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>Insighting Analytics</title>
        <meta name="description" content="AI-powered analytics platform - chat with your databases using natural language" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <ToastProvider>
            <AuthGuard>
              <AppShell>{children}</AppShell>
            </AuthGuard>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
