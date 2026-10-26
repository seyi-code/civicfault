"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { fetchMyOrg, fetchMe } from "@/lib/api";

const TOKEN_KEY = "civicfault_authority_token";
const ROLE_KEY = "civicfault_authority_role";
export const AUTH_EVENT = "civicfault-auth-changed";

/** Call after login / logout so the sticky header refreshes without a full reload. */
export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

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

  const refresh = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const cachedRole = localStorage.getItem(ROLE_KEY);

    // Instant UI from cached role (set at login) — no wait for network
    if (!token) {
      setOrgName(null);
      setOrgSlug(null);
      setIsPlatformAdmin(false);
      setAccent("#f59e0b");
      document.documentElement.style.setProperty("--cf-accent", "#f59e0b");
      return;
    }

    setIsPlatformAdmin(cachedRole === "admin");

    fetchMe(token)
      .then((me) => {
        const isAdmin = me.role === "admin";
        setIsPlatformAdmin(isAdmin);
        if (me.role) localStorage.setItem(ROLE_KEY, me.role);
      })
      .catch(() => {
        // Keep cached role if offline; only clear on explicit logout (no token)
      });

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
    refresh();
    const onAuth = () => refresh();
    window.addEventListener(AUTH_EVENT, onAuth);
    // Cross-tab login/logout
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, [refresh]);

  // Re-check when navigating (e.g. Authority → Dashboard after login)
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink">
          <AlertTriangle
            className="w-8 h-8 sm:w-9 sm:h-9 shrink-0"
            style={{ color: accent }}
            strokeWidth={2.25}
          />
          <div className="min-w-0">
            <div className="font-bold text-xl sm:text-2xl tracking-tight leading-none truncate">
              CivicFault
            </div>
            {orgName && (
              <div
                className="text-xs font-medium truncate max-w-[8rem] sm:max-w-[14rem] mt-0.5 leading-tight"
                style={{ color: accent }}
                title={orgSlug ? `Workspace · ${orgSlug}` : orgName}
              >
                {orgName}
              </div>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6 text-sm sm:text-base font-medium text-slate-600 shrink-0">
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
          {isPlatformAdmin && (
            <Link href="/admin" className="hover:text-violet-800 text-violet-700 transition whitespace-nowrap">
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
