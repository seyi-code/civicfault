"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  loginAuthority,
  registerAuthority,
  updateReportStatus,
  deleteReport,
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
import type { FaultReport, Organization } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";
import { AuthorityReportModal } from "@/components/AuthorityReportModal";
import {
  Loader2,
  Download,
  CreditCard,
  Building2,
  MessageSquare,
  AlertTriangle,
  User,
  Crown,
  Search,
  Eye,
  EyeOff,
  Link2,
  Copy,
  Shield,
} from "lucide-react";

const TOKEN_KEY = "civicfault_authority_token";
const PLAN_KEY = "civicfault_authority_plan";
const ROLE_KEY = "civicfault_authority_role";

export default function AuthorityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [role, setRole] = useState("authority");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<{ open?: number; overdue?: number; resolved?: number } | null>(null);
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
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FaultReport | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      [r.category, r.status, r.description || "", r.address_label || "", String(r.id)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [reports, search]);

  const residentLink =
    typeof window !== "undefined" && org
      ? `${window.location.origin}/?org=${org.slug}`
      : org
        ? `https://civicfault.vercel.app/?org=${org.slug}`
        : "";

  const isPlatformAdmin = role === "admin";

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const p = localStorage.getItem(PLAN_KEY) || "free";
    const r = localStorage.getItem(ROLE_KEY) || "authority";
    if (t) setToken(t);
    setPlan(p);
    setRole(r);
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
        if (me.role) {
          setRole(me.role);
          localStorage.setItem(ROLE_KEY, me.role);
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
      localStorage.setItem(ROLE_KEY, data.role || "authority");
      setToken(data.access_token);
      setPlan(data.plan || "free");
      setRole(data.role || "authority");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setPlan("free");
    setRole("authority");
    setOrg(null);
  }

  async function setStatus(id: number, status: string) {
    if (!token) return;
    setBusy(true);
    try {
      const updated = await updateReportStatus(id, status, token);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSelected((cur) => (cur && cur.id === id ? updated : cur));
      const s = await fetchOrgStats(token);
      if (s) setStats(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSoftDelete(id: number) {
    if (!token) return;
    setBusy(true);
    try {
      await deleteReport(id, token, false);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSelected(null);
      setInfo("Report soft-deleted (rejected & hidden)");
      const s = await fetchOrgStats(token);
      if (s) setStats(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function onHardDelete(id: number) {
    if (!token) return;
    setBusy(true);
    try {
      await deleteReport(id, token, true);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSelected(null);
      setInfo("Report permanently deleted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hard delete failed");
    } finally {
      setBusy(false);
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
      setInfo(`Workspace “${o.name}” created. Share /?org=${o.slug} with residents.`);
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

  function copyLink() {
    if (!residentLink) return;
    navigator.clipboard?.writeText(residentLink).then(
      () => setInfo("Resident link copied"),
      () => setInfo(residentLink)
    );
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Authority console</h1>
        <p className="text-sm text-slate-500 mb-6">Staff login · first account is platform admin</p>
        <form onSubmit={onAuth} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          {mode === "register" && (
            <>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </>
          )}
          <input type="email" required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} required minLength={8} className="w-full border rounded-lg px-3 py-2 pr-10 text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-semibold text-sm">
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
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold">Authority console</h1>
          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
            {profileEmail}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isPlatformAdmin ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              <Shield className="w-3 h-3" />
              {isPlatformAdmin ? "Platform admin" : role === "manager" ? "Org manager" : "Org staff"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setShowPlan((v) => !v); setShowProfile(false); }} className="inline-flex items-center gap-1.5 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-1.5 font-medium">
            <Crown className="w-4 h-4" /> Plan: {plan}
          </button>
          <button type="button" onClick={() => { setShowProfile((v) => !v); setShowPlan(false); }} className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5">
            <User className="w-4 h-4" /> Profile
          </button>
          <button onClick={() => downloadReportsCsv(token)} className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={logout} className="text-sm text-slate-500 px-2">Sign out</button>
        </div>
      </div>

      {org ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-emerald-800 uppercase tracking-wide">Workspace</div>
              <div className="font-semibold text-emerald-950">{org.name}</div>
              <div className="text-xs text-emerald-700/80">slug: {org.slug} · SLA {org.sla_hours}h</div>
            </div>
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-emerald-200 text-emerald-900 rounded-lg px-3 py-1.5">
              <Link2 className="w-3.5 h-3.5" /> Resident link <Copy className="w-3 h-3 opacity-60" />
            </button>
          </div>
          <p className="text-xs text-emerald-800/70 mt-2 break-all">{residentLink}</p>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <strong className="text-slate-800">No workspace yet.</strong>{" "}
          {isPlatformAdmin
            ? "As platform admin you can moderate the public feed. Create a workspace for estate-scoped ops."
            : "Create a private workspace for a dedicated resident link and org-scoped stats."}
        </div>
      )}

      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{info}</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {showPlan && (
        <div className="mb-4 bg-white border border-amber-100 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Subscription</h2>
          <p className="text-sm text-slate-600">Current: <strong className="capitalize">{plan}</strong></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => upgrade("paystack")} className="inline-flex items-center gap-1.5 text-sm bg-amber-500 text-white rounded-lg px-3 py-2 font-medium">
              <CreditCard className="w-4 h-4" /> {plan === "free" ? "Upgrade" : "Renew"} · Paystack
            </button>
            <button type="button" disabled={busy} onClick={() => upgrade("flutterwave")} className="inline-flex items-center gap-1.5 text-sm bg-orange-600 text-white rounded-lg px-3 py-2 font-medium">
              Flutterwave
            </button>
          </div>
        </div>
      )}

      {showProfile && (
        <form onSubmit={onSaveProfile} className="mb-4 bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-semibold text-sm">Profile</h2>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Full name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Organization" value={profileOrg} onChange={(e) => setProfileOrg(e.target.value)} />
          <div className="relative">
            <input type={showCurPass ? "text" : "password"} className="w-full border rounded-lg px-3 py-2 pr-10 text-sm" placeholder="Current password" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" onClick={() => setShowCurPass((v) => !v)}>{showCurPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          <div className="relative">
            <input type={showNewPass ? "text" : "password"} className="w-full border rounded-lg px-3 py-2 pr-10 text-sm" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" onClick={() => setShowNewPass((v) => !v)}>{showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm">Save</button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{stats?.open ?? 0}</div>
          <div className="text-xs text-slate-500">Open</div>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-600">{stats?.overdue ?? 0}</div>
          <div className="text-xs text-slate-500">Overdue</div>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-600">{stats?.resolved ?? 0}</div>
          <div className="text-xs text-slate-500">Resolved</div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!org && (
        <form onSubmit={onCreateOrg} className="mb-6 bg-white border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm"><Building2 className="w-4 h-4" /> Create private workspace</div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Slug (lowercase)" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notify phone +256" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
          <button type="submit" className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm">Create workspace</button>
        </form>
      )}

      {org && (
        <div className="mb-6 bg-white border rounded-2xl p-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Digest</div>
          <div className="flex gap-2">
            <input className="flex-1 border rounded-lg px-3 py-2 text-sm" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
            <button type="button" onClick={async () => { if (!token) return; try { const o = await updateMyOrg(token, { notify_phone: notifyPhone, notify_enabled: true }); setOrg(o); setInfo("Phone saved"); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Save failed"); } }} className="text-sm border rounded-lg px-3">Save</button>
            <button type="button" onClick={async () => { if (!token) return; try { const r = await sendDigest(token); setInfo(`Sent to ${r.to}`); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); } }} className="text-sm bg-emerald-600 text-white rounded-lg px-3">Send</button>
          </div>
        </div>
      )}

      {loadingReports && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}

      {!loadingReports && reports.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">
          {org ? "No reports in this workspace yet. Share the resident link." : "No reports in the current feed."}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-3 hover:border-amber-300 hover:shadow-sm transition"
            >
              <ReportImage path={r.image_url} className="w-full sm:w-28 h-24 object-cover rounded-lg" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold capitalize">{r.category.replace(/_/g, " ")}</span>
                  <StatusBadge status={r.status} />
                  {r.is_overdue && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{r.address_label || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`}</p>
                <p className="text-xs text-slate-400">#{r.id} · tap for details · {r.hours_open != null ? `${r.hours_open}h open` : ""}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <AuthorityReportModal
          report={selected}
          role={role}
          busy={busy}
          onClose={() => setSelected(null)}
          onStatus={setStatus}
          onSoftDelete={onSoftDelete}
          onHardDelete={isPlatformAdmin ? onHardDelete : undefined}
        />
      )}
    </div>
  );
}
