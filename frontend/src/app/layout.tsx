import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insighting Analytics",
  description: "Chat with your PostgreSQL databases using natural language",
};

const navItems = [
  { href: "/", label: "Chat" },
  { href: "/datasources", label: "Datasources" },
  { href: "/glossary", label: "Glossary" },
  { href: "/alerts", label: "Alerts" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex">
        {/* Sidebar */}
        <nav className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1 shrink-0">
          <h1 className="text-lg font-bold mb-6 text-white">Insighting</h1>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm hover:bg-gray-800 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
