import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

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
        <SiteHeader />
        <main>{children}</main>
        <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400">
          CivicFault · Community-driven infrastructure transparency
        </footer>
      </body>
    </html>
  );
}
