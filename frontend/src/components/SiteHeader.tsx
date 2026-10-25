"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchMyOrg } from "@/lib/api";

const TOKEN_KEY = "civicfault_authority_token";

function accentFromSlug(slug: string): string {
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
    <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Logo = home / report form */}
        <Link href="/" className="flex items-center gap-1.5 min-w-0 shrink">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: accent }} />
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-lg tracking-tight leading-tight truncate">
              CivicFault
            </div>
            {orgName && (
              <div
                className="text-[10px] sm:text-[11px] font-medium truncate max-w-[7rem] sm:max-w-[12rem] leading-tight"
                style={{ color: accent }}
                title={orgSlug ? `Workspace · ${orgSlug}` : orgName}
              >
                {orgName}
              </div>
            )}
          </div>
        </Link>

        {/* Report removed — logo already goes to / */}
        <nav className="flex items-center gap-2.5 sm:gap-5 text-xs sm:text-sm font-medium text-slate-600 shrink-0">
          <Link href="/dashboard" className="hover:text-slate-900 transition whitespace-nowrap">
            Dashboard
          </Link>
          <Link href="/resident" className="hover:text-slate-900 transition whitespace-nowrap">
            <span className="sm:hidden">Mine</span>
            <span className="hidden sm:inline">My reports</span>
          </Link>
          <Link href="/authority" className="hover:text-slate-900 transition whitespace-nowrap">
            Authority
          </Link>
        </nav>
      </div>
    </header>
  );
}
