"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { fetchMyOrg, fetchMe } from "@/lib/api";
import { AUTH_EVENT, notifyAuthChanged } from "@/lib/authEvents";

export { notifyAuthChanged };

const AUTH_TOKEN_KEY = "civicfault_authority_token";
const ROLE_KEY = "civicfault_authority_role";
const RES_TOKEN_KEY = "civicfault_resident_token";
/** Preferred hat when both sessions exist: resident | staff */
const CONTEXT_KEY = "civicfault_ui_context";

type UiContext = "resident" | "staff";

function accentFromSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 42%)`;
}

function isStaffRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/authority") || pathname.startsWith("/admin");
}

function isResidentRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/resident");
}

function readContext(): UiContext {
  if (typeof window === "undefined") return "staff";
  const v = localStorage.getItem(CONTEXT_KEY);
  return v === "resident" ? "resident" : "staff";
}

export function SiteHeader() {
  const pathname = usePathname();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [accent, setAccent] = useState("#f59e0b");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [hasResidentSession, setHasResidentSession] = useState(false);
  const [hasStaffSession, setHasStaffSession] = useState(false);
  const [uiContext, setUiContext] = useState<UiContext>("staff");

  const refresh = useCallback((full = true) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const resToken = localStorage.getItem(RES_TOKEN_KEY);
    const cachedRole = localStorage.getItem(ROLE_KEY);

    setHasResidentSession(!!resToken);
    setHasStaffSession(!!token);
    setUiContext(readContext());

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
          const color =
            (o as { primary_color?: string }).primary_color || accentFromSlug(o.slug);
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

  function setContext(next: UiContext) {
    localStorage.setItem(CONTEXT_KEY, next);
    setUiContext(next);
    notifyAuthChanged();
  }

  const both = hasResidentSession && hasStaffSession;

  // Route wins; elsewhere prefer Switch context hat
  let showWorkspaceBrand = false;
  let showResidentBrand = false;
  let logoColor = "#f59e0b";

  if (isResidentRoute(pathname)) {
    showResidentBrand = hasResidentSession;
    showWorkspaceBrand = false;
    logoColor = "#f59e0b";
  } else if (isStaffRoute(pathname)) {
    showWorkspaceBrand = !!orgName;
    showResidentBrand = false;
    logoColor = orgName ? accent : "#f59e0b";
  } else {
    // Public / dashboard / home
    if (both) {
      if (uiContext === "staff" && orgName) {
        showWorkspaceBrand = true;
        logoColor = accent;
      } else if (uiContext === "resident" && hasResidentSession) {
        showResidentBrand = true;
        logoColor = "#f59e0b";
      } else if (orgName) {
        showWorkspaceBrand = true;
        logoColor = accent;
      }
    } else if (hasStaffSession && orgName) {
      showWorkspaceBrand = true;
      logoColor = accent;
    } else if (hasResidentSession) {
      showResidentBrand = true;
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink overflow-hidden">
          <AlertTriangle
            className="w-7 h-7 sm:w-9 sm:h-9 shrink-0"
            style={{ color: logoColor }}
            strokeWidth={2.25}
          />
          <div className="min-w-0 overflow-hidden">
            <div className="font-bold text-base sm:text-2xl tracking-tight leading-none truncate">
              CivicFault
            </div>
            {showWorkspaceBrand && (
              <div
                className="text-[10px] sm:text-xs font-medium truncate max-w-[5.5rem] sm:max-w-[14rem] mt-0.5 leading-tight"
                style={{ color: accent }}
                title={orgSlug ? `Workspace · ${orgSlug}` : orgName || undefined}
              >
                {orgName}
              </div>
            )}
            {showResidentBrand && (
              <div
                className="text-[10px] sm:text-xs font-medium truncate max-w-[5.5rem] sm:max-w-[14rem] mt-0.5 leading-tight text-emerald-700"
                title="Resident account"
              >
                Resident
              </div>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5 text-xs sm:text-base font-medium text-slate-600 shrink-0">
          <Link href="/dashboard" className="hover:text-slate-900 transition whitespace-nowrap">
            <span className="hidden sm:inline">Dashboard</span>
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

      {both && (
        <div className="max-w-6xl mx-auto mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] sm:text-xs text-slate-400">Acting as</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              type="button"
              onClick={() => setContext("resident")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-medium transition ${
                uiContext === "resident"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Resident
            </button>
            <button
              type="button"
              onClick={() => setContext("staff")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-medium transition ${
                uiContext === "staff"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Staff{orgName ? ` · ${orgName}` : ""}
            </button>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Routes still enforce roles; this only changes branding on public pages.
          </span>
        </div>
      )}
    </header>
  );
}
