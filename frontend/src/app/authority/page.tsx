"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  fetchReports,
  loginAuthority,
  registerAuthority,
  updateReportStatus,
  mediaUrl,
} from "@/lib/api";
import type { FaultReport, FaultStatus } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2 } from "lucide-react";

const STATUSES: FaultStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "resolved",
  "rejected",
];

const TOKEN_KEY = "civicfault_authority_token";

export default function AuthorityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [org, setOrg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) setToken(t);
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
      setToken(data.access_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Authority console</h1>
          <p className="text-sm text-slate-500">Update report status for residents</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>
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
            {mediaUrl(r.image_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(r.image_url)!}
                alt=""
                className="w-full sm:w-28 h-24 object-cover rounded-lg bg-slate-100"
              />
            )}
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
