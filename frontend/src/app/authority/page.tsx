"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  fetchReports,
  loginAuthority,
  registerAuthority,
  updateReportStatus,
  initPaystack,
  verifyPaystack,
  downloadReportsCsv,
} from "@/lib/api";
import type { FaultReport, FaultStatus } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";
import { Loader2, Download, CreditCard } from "lucide-react";

const STATUSES: FaultStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "resolved",
  "rejected",
];

const TOKEN_KEY = "civicfault_authority_token";
const PLAN_KEY = "civicfault_authority_plan";

export default function AuthorityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [org, setOrg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const p = localStorage.getItem(PLAN_KEY) || "free";
    if (t) setToken(t);
    setPlan(p);

    // Return from Paystack
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("reference") || params.get("trxref");
      if (t && ref) {
        verifyPaystack(t, ref)
          .then((d) => {
            setPlan(d.plan || "authority");
            localStorage.setItem(PLAN_KEY, d.plan || "authority");
            setInfo("Payment verified — Authority plan active.");
            window.history.replaceState({}, "", "/authority");
          })
          .catch((e) => setError(e.message));
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoadingReports(true);
    fetchReports()
      .then((d) => setReports(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingReports(false));
  }, [token]);

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await registerAuthority({
          email,
          password,
          full_name: fullName || undefined,
          organization: org || undefined,
        });
      }
      const data = await loginAuthority(email, password);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(PLAN_KEY, data.plan || "free");
      setToken(data.access_token);
      setPlan(data.plan || "free");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAN_KEY);
    setToken(null);
    setPlan("free");
  }

  async function setStatus(id: number, status: string) {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateReportStatus(id, status, token);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function upgrade() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const data = await initPaystack(token, "authority_monthly");
      window.location.href = data.authorization_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment start failed");
      setBusy(false);
    }
  }

  async function onExport() {
    if (!token) return;
    try {
      await downloadReportsCsv(token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Authority console</h1>
        <p className="text-sm text-slate-500 mb-6">
          For utility / council staff. First account registers as admin.
        </p>
        <form
          onSubmit={onAuth}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
        >
          {mode === "register" && (
            <>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Organization (e.g. KCCA)"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              />
            </>
          )}
          <input
            type="email"
            required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin inline" />
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account & sign in"
            )}
          </button>
          <button
            type="button"
            className="w-full text-sm text-slate-500"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Authority console</h1>
          <p className="text-sm text-slate-500">
            Plan: <span className="font-medium capitalize">{plan}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          {plan === "free" && (
            <button
              onClick={upgrade}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm bg-amber-500 text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" /> Upgrade (Paystack)
            </button>
          )}
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800 px-2">
            Sign out
          </button>
        </div>
      </div>

      {info && (
        <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-4">{info}</div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>
      )}

      {plan === "free" && (
        <div className="mb-6 text-sm bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-900">
          <strong>Free plan.</strong> Status updates work. Upgrade with Paystack for full CSV
          (5,000 rows), longer retention messaging, and estate features coming next.
          Monthly: UGX 150,000 (configurable in API).
        </div>
      )}

      {loadingReports && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      <ul className="space-y-3">
        {reports.map((r) => (
          <li
            key={r.id}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3"
          >
            <ReportImage
              path={r.image_url}
              className="w-full sm:w-28 h-24 object-cover rounded-lg"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold capitalize">
                  {r.category.replace(/_/g, " ")}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-slate-400 mb-2">
                #{r.id} · {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
              </p>
              <select
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
