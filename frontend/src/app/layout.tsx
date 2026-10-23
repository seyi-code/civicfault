import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CivicFault – Community Infrastructure Tracker",
  description:
    "Report and track local infrastructure failures. Photo + GPS + AI classification + public transparency dashboard.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CivicFault",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-6 h-6" />
              <span className="font-bold text-lg tracking-tight">CivicFault</span>
            </Link>
            <nav className="flex gap-5 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-slate-900 transition">
                Report
              </Link>
              <Link href="/dashboard" className="hover:text-slate-900 transition">
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400">
          CivicFault · Community-driven infrastructure transparency
        </footer>
      </body>
    </html>
  );
}
