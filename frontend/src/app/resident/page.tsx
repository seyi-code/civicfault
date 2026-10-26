"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, User, Settings, Eye, EyeOff } from "lucide-react";
import {
  registerResident,
  loginResident,
  fetchMyResidentReports,
  fetchResidentMe,
  updateResidentProfile,
  fetchFollows,
  followWorkspace,
  unfollowWorkspace,
  type WorkspaceFollow,
} from "@/lib/residentApi";
import { API_BASE } from "@/lib/api";
import type { FaultReport } from "@/types";
import { ReportImage } from "@/components/ReportImage";
import { ReportBadges } from "@/components/ReportBadges";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { formatDateTime } from "@/lib/format";

const RES_TOKEN = "civicfault_resident_token";

async function fetchOrgReports(slug: string): Promise<FaultReport[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/reports?org_slug=${encodeURIComponent(slug)}&public_only=false&page_size=30`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

export default function ResidentPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; full_name?: string; phone?: string } | null>(null);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [followingFeed, setFollowingFeed] = useState<FaultReport[]>([]);
  const [selected, setSelected] = useState<FaultReport | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [follows, setFollows] = useState<WorkspaceFollow[]>([]);
  const [followSlug, setFollowSlug] = useState("");
  const [tab, setTab] = useState<"mine" | "following">("mine");

  useEffect(() => {
    const t = localStorage.getItem(RES_TOKEN);
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const meRes = await fetchResidentMe(token);
        if (cancelled) return;
        setMe(meRes);
        setProfileName(meRes.full_name || "");
        setProfilePhone(meRes.phone || "");

        const [list, f] = await Promise.all([
          fetchMyResidentReports(token).catch(() => [] as FaultReport[]),
          fetchFollows(token).catch(() => [] as WorkspaceFollow[]),
        ]);
        if (cancelled) return;
        setReports(list);
        setFollows(f);

        if (f.length) {
          const batches = await Promise.all(f.map((x) => fetchOrgReports(x.slug)));
          if (cancelled) return;
          const byId = new Map<number, FaultReport>();
          batches.flat().forEach((r) => byId.set(r.id, r));
          setFollowingFeed(
            Array.from(byId.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          );
        } else setFollowingFeed([]);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not load account";
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          setError(
            "Cannot reach API — check connection or wait for Railway redeploy, then refresh."
          );
          return;
        }
        setError(msg);
        if (/session expired|401|not authenticated|resident account required/i.test(msg)) {
          localStorage.removeItem(RES_TOKEN);
          setToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await registerResident({ email, password, full_name: fullName || undefined });
      }
      const data = await loginResident(email, password);
      localStorage.setItem(RES_TOKEN, data.access_token);
      setToken(data.access_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateResidentProfile(token, {
        full_name: profileName || undefined,
        phone: profilePhone || undefined,
        current_password: curPass || undefined,
        new_password: newPass || undefined,
      });
      setMe(updated);
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

  async function onFollow(e: FormEvent) {
    e.preventDefault();
    if (!token || !followSlug.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const f = await followWorkspace(token, followSlug.trim());
      setFollows((prev) =>
        prev.some((x) => x.organization_id === f.organization_id) ? prev : [...prev, f]
      );
      setFollowSlug("");
      setInfo(`Following ${f.name}`);
      const items = await fetchOrgReports(f.slug);
      setFollowingFeed((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        items.forEach((r) => map.set(r.id, r));
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUnfollow(slug: string) {
    if (!token) return;
    try {
      await unfollowWorkspace(token, slug);
      setFollows((prev) => prev.filter((f) => f.slug !== slug));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unfollow failed");
    }
  }

  function logout() {
    localStorage.removeItem(RES_TOKEN);
    setToken(null);
    setMe(null);
    setReports([]);
    setFollows([]);
    setFollowingFeed([]);
  }

  function renderList(items: FaultReport[]) {
    if (!items.length) {
      return (
        <div className="text-center py-10 text-slate-400 text-sm">
          {tab === "mine" ? (
            <>
              No reports linked yet.{" "}
              <Link href="/" className="text-amber-700 underline">
                File while signed in
              </Link>
            </>
          ) : (
            "Follow a workspace to see its reports here."
          )}
        </div>
      );
    }
    return (
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left bg-white border rounded-2xl overflow-hidden flex flex-col sm:flex-row hover:border-amber-300"
            >
              <ReportImage path={r.image_url} className="sm:w-36 h-28 object-cover w-full" />
              <div className="p-3 flex-1 min-w-0">
                <div className="font-semibold capitalize">{r.category.replace(/_/g, " ")}</div>
                <ReportBadges report={r} />
                <p className="text-xs text-slate-400 mt-1">
                  #{r.id} · {formatDateTime(r.created_at)}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Resident account</h1>
        <p className="text-sm text-slate-500 mb-6">
          Track reports, follow estates. Free — not staff login.
        </p>
        <form onSubmit={onAuth} className="bg-white border rounded-2xl p-5 space-y-3 shadow-sm">
          {mode === "register" && (
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            type="email"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              className="w-full border rounded-lg px-3 py-2 pr-10 text-sm"
              placeholder="Password (min 8)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-semibold text-sm"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-slate-500"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "New here? Register" : "Have an account? Sign in"}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-4 text-center">
          Staff? <Link href="/authority" className="underline">Authority console</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Resident</h1>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <User className="w-4 h-4" />
            {me?.full_name || me?.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowProfile((v) => !v)}
            className="text-sm border rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
          >
            <Settings className="w-4 h-4" /> Profile
          </button>
          <Link
            href="/"
            className="text-sm border rounded-lg px-3 py-1.5 bg-amber-50 border-amber-200 text-amber-900 font-medium"
          >
            New report
          </Link>
          <button type="button" onClick={logout} className="text-sm text-slate-500 inline-flex items-center gap-1 px-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{info}</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {showProfile && (
        <form onSubmit={onSaveProfile} className="mb-4 bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-semibold text-sm">Edit profile</h2>
          <p className="text-xs text-slate-400">{me?.email}</p>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Full name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Phone (optional)"
            value={profilePhone}
            onChange={(e) => setProfilePhone(e.target.value)}
          />
          <div className="relative">
            <input
              type={showCurPass ? "text" : "password"}
              className="w-full border rounded-lg px-3 py-2 pr-10 text-sm"
              placeholder="Current password (if changing)"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" onClick={() => setShowCurPass((v) => !v)}>
              {showCurPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showNewPass ? "text" : "password"}
              className="w-full border rounded-lg px-3 py-2 pr-10 text-sm"
              placeholder="New password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" onClick={() => setShowNewPass((v) => !v)}>
              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm">
            Save profile
          </button>
        </form>
      )}

      <div className="mb-4 bg-white border rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-2">Follow a workspace</h2>
        <p className="text-xs text-slate-500 mb-3">
          Use the slug from the resident link (e.g. <code className="bg-slate-100 px-1 rounded">lc1</code>).
        </p>
        <form onSubmit={onFollow} className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="workspace-slug"
            value={followSlug}
            onChange={(e) => setFollowSlug(e.target.value)}
          />
          <button type="submit" disabled={busy} className="text-sm bg-emerald-600 text-white rounded-lg px-4 py-2 font-medium">
            Follow
          </button>
        </form>
        {follows.length > 0 && (
          <ul className="mt-3 space-y-1">
            {follows.map((f) => (
              <li key={f.organization_id} className="flex justify-between items-center text-sm">
                <span>
                  <strong>{f.name}</strong> <span className="text-slate-400">({f.slug})</span>
                </span>
                <button type="button" className="text-xs text-red-600" onClick={() => onUnfollow(f.slug)}>
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`text-sm rounded-lg px-3 py-1.5 border font-medium ${
            tab === "mine" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"
          }`}
        >
          My reports ({reports.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("following")}
          className={`text-sm rounded-lg px-3 py-1.5 border font-medium ${
            tab === "following" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"
          }`}
        >
          Following ({followingFeed.length})
        </button>
      </div>

      {renderList(tab === "mine" ? reports : followingFeed)}

      {selected && <ReportDetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
