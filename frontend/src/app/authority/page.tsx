"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  loginAuthority,
  registerAuthority,
  updateReportStatus,
  initPayment,
  verifyPayment,
  downloadReportsCsv,
  fetchWorkspaceReports,
  fetchMyOrg,
  createOrg,
  updateMyOrg,
  sendDigest,
  fetchOrgStats,
  fetchMe,
  updateProfile,
} from "@/lib/api";
import type { FaultReport, FaultStatus, Organization } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";
import {
  Loader2,
  Download,
  CreditCard,
  Building2,
  MessageSquare,
  AlertTriangle,
  User,
  Crown,
} from "lucide-react";

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
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<{
    open?: number;
    overdue?: number;
    resolved?: number;
    total?: number;
    scope?: string;
  } | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [notifyPhone, setNotifyPhone] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileOrg, setProfileOrg] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const breakdown = useMemo(() => {
    const c = { pending: 0, confirmed: 0, in_progress: 0, resolved: 0, rejected: 0 };
    for (const r of reports) {
      if (r.status in c) c[r.status as keyof typeof c] += 1;
    }
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return reports;
    if (statusFilter === "open") {
      return reports.filter((r) =>
        ["pending", "confirmed", "in_progress"].includes(r.status)
      );
    }
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const p = localStorage.getItem(PLAN_KEY) || "free";
    if (t) setToken(t);
    setPlan(p);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("reference") || params.get("trxref") || params.get("tx_ref");
      const provider = (params.get("provider") as "paystack" | "flutterwave") || "paystack";
      if (t && ref) {
        verifyPayment(t, ref, provider)
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
    Promise.all([fetchWorkspaceReports(token), fetchMyOrg(token), fetchOrgStats(token), fetchMe(token)])
      .then(([list, o, s, me]) => {
        setReports(list.items || []);
        setOrg(o);
        setStats(s);
        if (o?.notify_phone) setNotifyPhone(o.notify_phone);
        setProfileName(me.full_name || "");
        setProfileOrg(me.organization || "");
        setProfileEmail(me.email);
        if (me.plan) {
          setPlan(me.plan);
          localStorage.setItem(PLAN_KEY, me.plan);
        }
      })
      .catch((e) => {
        if (String(e.message).includes("401")) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setError("Session expired — sign in again");
        } else setError(e.message);
      })
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
          organization: orgName || undefined,
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
    setOrg(null);
  }

  async function setStatus(id: number, status: string) {
    if (!token) return;
    try {
      const updated = await updateReportStatus(id, status, token);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      const s = await fetchOrgStats(token);
      if (s) setStats(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function upgrade(provider: "paystack" | "flutterwave") {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await initPayment(token, "authority_monthly", provider);
      window.location.href = data.authorization_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment start failed");
      setBusy(false);
    }
  }

  async function onCreateOrg(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const o = await createOrg(token, {
        name: newOrgName,
        slug: newOrgSlug || newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        visibility: "private",
        sla_hours: 72,
        notify_phone: notifyPhone || undefined,
      });
      setOrg(o);
      setInfo(`Workspace “${o.name}” created. Residents use /?org=${o.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Org create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      await updateProfile(token, {
        full_name: profileName || undefined,
        organization: profileOrg || undefined,
        current_password: curPass || undefined,
        new_password: newPass || undefined,
      });
      setInfo("Profile saved");
      setCurPass("");
      setNewPass("");
      setShowProfile(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Profile failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSavePhone() {
    if (!token) return;
    try {
      const o = await updateMyOrg(token, { notify_phone: notifyPhone, notify_enabled: true });
      setOrg(o);
      setInfo("Notify phone saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onDigest() {
    if (!token) return;
    setBusy(true);
    try {
      const r = await sendDigest(token);
      setInfo(`Digest sent to ${r.to}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Digest failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Authority console</h1>
        <p className="text-sm text-slate-500 mb-6">Staff login · first account is admin</p>
        <form onSubmit={onAuth} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          {mode === "register" && (
            <>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </>
          )}
          <input type="email" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required minLength={8} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="w-full text-sm text-slate-500" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Authority console</h1>
          <p className="text-sm text-slate-500">
            {profileEmail && <span className="mr-2">{profileEmail}</span>}
            {org && (
              <>
                · {org.name} <span className="text-slate-400">({org.slug})</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowPlan((v) => !v);
              setShowProfile(false);
            }}
            className="inline-flex items-center gap-1.5 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-1.5 font-medium"
          >
            <Crown className="w-4 h-4" />
            Plan: {plan}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowProfile((v) => !v);
              setShowPlan(false);
            }}
            className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5"
          >
            <User className="w-4 h-4" /> Profile
          </button>
          <button onClick={() => downloadReportsCsv(token)} className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={logout} className="text-sm text-slate-500 px-2">
            Sign out
          </button>
        </div>
      </div>

      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{info}</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {showPlan && (
        <div className="mb-4 bg-white border border-amber-100 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" /> Subscription
          </h2>
          <p className="text-sm text-slate-600">
            Current plan: <strong className="capitalize">{plan}</strong>
            {plan === "free"
              ? " — upgrade for full CSV export and estate features."
              : " — thank you. Manage renewals via Paystack/Flutterwave or contact support."}
          </p>
          {plan === "free" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => upgrade("paystack")}
                className="inline-flex items-center gap-1.5 text-sm bg-amber-500 text-white rounded-lg px-3 py-2 font-medium"
              >
                <CreditCard className="w-4 h-4" /> Paystack · UGX 150k/mo
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => upgrade("flutterwave")}
                className="inline-flex items-center gap-1.5 text-sm bg-orange-600 text-white rounded-lg px-3 py-2 font-medium"
              >
                Flutterwave
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400">
            Admins can also grant plans via API: POST /api/v1/orgs/admin/set-plan
          </p>
        </div>
      )}

      {showProfile && (
        <form onSubmit={onSaveProfile} className="mb-4 bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h2>
          <p className="text-xs text-slate-400">{profileEmail}</p>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Full name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Organization label"
            value={profileOrg}
            onChange={(e) => setProfileOrg(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Current password (only if changing)"
            value={curPass}
            onChange={(e) => setCurPass(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="New password (min 8)"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm font-medium">
            Save profile
          </button>
        </form>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{stats?.open ?? breakdown.pending + breakdown.confirmed + breakdown.in_progress}</div>
          <div className="text-xs text-slate-500">Open</div>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-600">{stats?.overdue ?? 0}</div>
          <div className="text-xs text-slate-500">Overdue</div>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-600">{stats?.resolved ?? breakdown.resolved}</div>
          <div className="text-xs text-slate-500">Resolved</div>
        </div>
      </div>

      {/* Per-status breakdown */}
      <div className="grid grid-cols-5 gap-1.5 mb-6 text-center">
        {(["pending", "confirmed", "in_progress", "resolved", "rejected"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`rounded-lg border px-1 py-2 ${statusFilter === s ? "border-amber-400 bg-amber-50" : "bg-white border-slate-200"}`}
          >
            <div className="text-sm font-bold">{breakdown[s]}</div>
            <div className="text-[10px] text-slate-500 leading-tight capitalize">{s.replace(/_/g, " ")}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mb-4 -mt-4">
        Open = pending + confirmed + in progress. Overdue = open past SLA (default 72h). Tap a status to filter.
      </p>

      {!org && (
        <form onSubmit={onCreateOrg} className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Building2 className="w-4 h-4" /> Create private workspace
          </div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name e.g. Acacia Estate" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Slug e.g. acacia-estate" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notify phone +256..." value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm font-medium">
            Create workspace
          </button>
        </form>
      )}

      {org && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> WhatsApp / SMS digest
          </div>
          <div className="flex gap-2">
            <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="+2567..." value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
            <button type="button" onClick={onSavePhone} className="text-sm border rounded-lg px-3">
              Save
            </button>
            <button type="button" onClick={onDigest} disabled={busy} className="text-sm bg-emerald-600 text-white rounded-lg px-3">
              Send now
            </button>
          </div>
        </div>
      )}

      {loadingReports && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((r) => (
          <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <ReportImage path={r.image_url} className="w-full sm:w-28 h-24 object-cover rounded-lg" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold capitalize">{r.category.replace(/_/g, " ")}</span>
                <StatusBadge status={r.status} />
                {r.is_overdue && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Overdue
                  </span>
                )}
                {r.hours_open != null && <span className="text-xs text-slate-400">{r.hours_open}h open</span>}
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
