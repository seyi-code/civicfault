"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, User, Settings } from "lucide-react";
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
import type { FaultReport } from "@/types";
import { ReportImage } from "@/components/ReportImage";
import { ReportBadges } from "@/components/ReportBadges";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { formatDateTime } from "@/lib/format";

const RES_TOKEN = "civicfault_resident_token";

export default function ResidentPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [me, setMe] = useState<{
    email: string;
    full_name?: string;
    phone?: string;
  } | null>(null);
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [selected, setSelected] = useState<FaultReport | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [follows, setFollows] = useState<WorkspaceFollow[]>([]);
  const [followSlug, setFollowSlug] = useState("");

  useEffect(() => {
    const t = localStorage.getItem(RES_TOKEN);
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchResidentMe(token), fetchMyResidentReports(token), fetchFollows(token)])
      .then(([m, list, f]) => {
        setMe(m);
        setProfileName(m.full_name || "");
        setProfilePhone(m.phone || "");
        setReports(list);
        setFollows(f);
      })
      .catch((e) => {
        setError(e.message);
        if (String(e.message).toLowerCase().includes("401") || String(e.message).includes("auth")) {
          localStorage.removeItem(RES_TOKEN);
          setToken(null);
        }
      });
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
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Resident account</h1>
        <p className="text-sm text-slate-500 mb-6">
          Track reports, edit profile, follow your estate. Free — not staff login.
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
          <input
            type="password"
            required
            minLength={8}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
          Staff? Use <Link href="/authority" className="underline">Authority console</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">My reports</h1>
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
          <button
            type="button"
            onClick={logout}
            className="text-sm text-slate-500 inline-flex items-center gap-1 px-2"
          >
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
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Current password (if changing)"
            value={curPass}
            onChange={(e) => setCurPass(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="New password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-xl py-2 text-sm">
            Save profile
          </button>
        </form>
      )}

      <div className="mb-6 bg-white border rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-2">Follow a workspace</h2>
        <p className="text-xs text-slate-500 mb-3">
          Enter the estate slug from the resident link (e.g. <code className="bg-slate-100 px-1 rounded">code-estate</code>
          from <code className="bg-slate-100 px-1 rounded">/?org=code-estate</code>). You&apos;ll see it listed here; staff still own triage.
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
                  <strong>{f.name}</strong>{" "}
                  <span className="text-slate-400">({f.slug})</span>
                </span>
                <button type="button" className="text-xs text-red-600" onClick={() => onUnfollow(f.slug)}>
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No reports linked to this account yet.
          <br />
          <Link href="/" className="text-amber-700 underline mt-2 inline-block">
            File a report while signed in
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
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
      )}

      {selected && <ReportDetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
