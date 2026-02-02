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
} from "@heroicons/react/24/outline";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "./globals.css";

const navItems = [
  { href: "/", label: "Chat", Icon: ChatBubbleLeftRightIcon },
  { href: "/datasources", label: "Datasources", Icon: CircleStackIcon },
  { href: "/glossary", label: "Glossary", Icon: BookOpenIcon },
  { href: "/alerts", label: "Alerts", Icon: BellAlertIcon },
  { href: "/admin", label: "Admin", Icon: Cog6ToothIcon },
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

  if (pathname === "/login" || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <nav
        className={`${
          collapsed ? "w-16" : "w-56"
        } glass border-r border-gray-800 p-3 flex flex-col shrink-0 transition-all duration-200`}
      >
        <div className="flex items-center justify-between mb-6 px-1">
          {!collapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
              Insighting
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ChevronLeftIcon className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5 flex-1">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-blue-600/20 text-blue-400 font-medium shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-gray-800 pt-3 mt-3">
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors w-full"
          >
            <ArrowRightOnRectangleIcon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Insighting Analytics</title>
        <meta name="description" content="Chat with your PostgreSQL databases using natural language" />
      </head>
      <body className="text-gray-100 min-h-screen font-sans">
        <AuthProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
