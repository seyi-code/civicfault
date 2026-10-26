"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { fetchMyOrg, fetchMe } from "@/lib/api";
import { AUTH_EVENT, notifyAuthChanged } from "@/lib/authEvents";

export { notifyAuthChanged };

const TOKEN_KEY = "civicfault_authority_token";
const ROLE_KEY = "civicfault_authority_role";

function accentFromSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 42%)`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [accent, setAccent] = useState("#f59e0b");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const refresh = useCallback((full = true) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const cachedRole = localStorage.getItem(ROLE_KEY);

    if (!token) {
      setOrgName(null);
      setOrgSlug(null);
      setIsPlatformAdmin(false);
      setAccent("#f59e0b");
      document.documentElement.style.setProperty("--cf-accent", "#f59e0b");
      return;
    }

    setIsPlatformAdmin(cachedRole === "admin");

    if (!full) return;

    fetchMe(token)
      .then((me) => {
        setIsPlatformAdmin(me.role === "admin");
        if (me.role) localStorage.setItem(ROLE_KEY, me.role);
      })
      .catch(() => {});

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

  useEffect(() => {
    refresh(true);
    const onAuth = () => refresh(true);
    window.addEventListener(AUTH_EVENT, onAuth);
    window.addEventListener("storage", onAuth);
    const poll = window.setInterval(() => refresh(false), 800);
    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth);
      window.removeEventListener("storage", onAuth);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    refresh(true);
  }, [pathname, refresh]);

  return (
    <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink overflow-hidden">
          <AlertTriangle
            className="w-7 h-7 sm:w-9 sm:h-9 shrink-0"
            style={{ color: accent }}
            strokeWidth={2.25}
          />
          <div className="min-w-0 overflow-hidden">
            <div className="font-bold text-base sm:text-2xl tracking-tight leading-none truncate">
              <span className="sm:hidden">CivicFault</span>
              <span className="hidden sm:inline">CivicFault</span>
            </div>
            {orgName && (
              <div
                className="text-[10px] sm:text-xs font-medium truncate max-w-[5.5rem] sm:max-w-[14rem] mt-0.5 leading-tight"
                style={{ color: accent }}
                title={orgSlug ? `Workspace · ${orgSlug}` : orgName}
              >
                {orgName}
              </div>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5 text-xs sm:text-base font-medium text-slate-600 shrink-0">
          <Link href="/dashboard" className="hover:text-slate-900 transition whitespace-nowrap">
            <span className="hidden xs:inline sm:inline">Dashboard</span>
            <span className="sm:hidden">Dash</span>
          </Link>
          <Link href="/resident" className="hover:text-slate-900 transition whitespace-nowrap">
            Mine
          </Link>
          <Link href="/authority" className="hover:text-slate-900 transition whitespace-nowrap">
            <span className="sm:hidden">Auth</span>
            <span className="hidden sm:inline">Authority</span>
          </Link>
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="hover:text-violet-800 text-violet-700 transition whitespace-nowrap font-semibold"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
