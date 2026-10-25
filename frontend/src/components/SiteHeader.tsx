"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchMyOrg } from "@/lib/api";

const TOKEN_KEY = "civicfault_authority_token";

function accentFromSlug(slug: string): string {
  // Stable HSL accent from slug for workspace identity
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 42%)`;
}

export function SiteHeader() {
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [accent, setAccent] = useState("#f59e0b");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setOrgName(null);
      setOrgSlug(null);
      setAccent("#f59e0b");
      document.documentElement.style.setProperty("--cf-accent", "#f59e0b");
      return;
    }
    fetchMyOrg(token)
      .then((o) => {
        if (o) {
          setOrgName(o.name);
          setOrgSlug(o.slug);
          const color = o.primary_color || accentFromSlug(o.slug);
          setAccent(color);
          document.documentElement.style.setProperty("--cf-accent", color);
        } else {
          setOrgName(null);
          setOrgSlug(null);
          setAccent("#f59e0b");
          document.documentElement.style.setProperty("--cf-accent", "#f59e0b");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-6 h-6 shrink-0" style={{ color: accent }} />
          <span className="font-bold text-lg tracking-tight">CivicFault</span>
          {orgName && (
            <span
              className="hidden sm:inline-flex items-center max-w-[10rem] truncate text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: accent }}
              title={orgSlug ? `Workspace · ${orgSlug}` : orgName}
            >
              {orgName}
            </span>
          )}
        </Link>
        <nav className="flex gap-4 sm:gap-5 text-sm font-medium text-slate-600 shrink-0">
          <Link href="/" className="hover:text-slate-900 transition">
            Report
          </Link>
          <Link href="/dashboard" className="hover:text-slate-900 transition">
            Dashboard
          </Link>
          <Link href="/authority" className="hover:text-slate-900 transition">
            Authority
          </Link>
        </nav>
      </div>
    </header>
  );
}
