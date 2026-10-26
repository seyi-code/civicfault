"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import {
  adminListResidents,
  adminSetResidentActive,
} from "@/lib/residentApi";
import { API_BASE, formatApiError, fetchMe } from "@/lib/api";

type OrgRow = {
  id: number;
  name: string;
  slug: string;
  plan: string;
  sla_hours: number;
  is_active?: boolean;
};

type ResidentRow = {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
};

export function PlatformAdminPanel({ token }: { token: string }) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planEmail, setPlanEmail] = useState("");
  const [plan, setPlan] = useState("authority");
  const [planDays, setPlanDays] = useState(30);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [oRes, rList, me] = await Promise.all([
        fetch(`${API_BASE}/api/v1/orgs/admin/list`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        adminListResidents(token, q || undefined),
        fetchMe(token),
      ]);
      if (!oRes.ok) throw new Error("Could not load organizations");
      setOrgs(await oRes.json());
      setResidents(rList);
      setAdminEmail(me.email?.toLowerCase() || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const targetIsSelfAdmin =
    !!adminEmail && planEmail.trim().toLowerCase() === adminEmail;

  async function grantPlan(e: FormEvent) {
    e.preventDefault();
    if (targetIsSelfAdmin) {
      setError(
        "Platform admin already has full system access — no plan grant needed. Use a workspace staff email (e.g. lc1@…)."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/orgs/admin/set-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          days: planDays,
          user_email: planEmail || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, "Grant failed"));
      const daysLabel =
        data.plan_expires_at == null ? "unlimited" : `${planDays} days`;
      setInfo(`Granted ${data.plan} to ${data.email} (${daysLabel})`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleResident(id: number, is_active: boolean) {
    setBusy(true);
    try {
      await adminSetResidentActive(token, id, is_active);
      setResidents((prev) => prev.map((r) => (r.id === id ? { ...r, is_active } : r)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 border border-violet-200 bg-violet-50/50 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-violet-700" />
        <h2 className="font-semibold text-violet-950">Platform admin</h2>
      </div>
      <p className="text-xs text-violet-800/80">
        Full system access is tied to your <strong>admin role</strong>, not a paid plan. Grant plans only to
        workspace staff / orgs (customers).
      </p>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{info}</div>}

      <form onSubmit={grantPlan} className="bg-white border rounded-xl p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase">Grant plan to workspace staff</div>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Staff email (e.g. lc1@kcca.co.ug) — not platform admin"
          value={planEmail}
          onChange={(e) => setPlanEmail(e.target.value)}
          required
        />
        {targetIsSelfAdmin && (
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
            That email is the platform admin. Access is already unlimited — pick an org staff email instead.
          </p>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[7rem]">
            <label className="text-[10px] uppercase text-slate-400 font-semibold">Plan</label>
            <select
              className="w-full border rounded-lg px-2 py-2 text-sm"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              disabled={targetIsSelfAdmin}
            >
              <option value="free">free</option>
              <option value="authority">authority</option>
              <option value="enterprise">enterprise</option>
            </select>
          </div>
          <div className="w-24">
            <label className="text-[10px] uppercase text-slate-400 font-semibold">Days</label>
            <input
              type="number"
              min={1}
              max={3650}
              className="w-full border rounded-lg px-2 py-2 text-sm"
              value={planDays}
              onChange={(e) => setPlanDays(Number(e.target.value) || 30)}
              disabled={targetIsSelfAdmin}
              title="How many days this plan lasts"
            />
          </div>
          <button
            type="submit"
            disabled={busy || targetIsSelfAdmin}
            className="text-sm bg-violet-700 text-white rounded-lg px-3 py-2 font-medium disabled:opacity-50"
          >
            Grant
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Authority = paid workspace tools. Enterprise = same + higher limits (see docs). Days = subscription length.
        </p>
      </form>

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Organizations ({orgs.length})
        </div>
        <ul className="bg-white border rounded-xl divide-y max-h-48 overflow-y-auto text-sm">
          {orgs.map((o) => (
            <li key={o.id} className="px-3 py-2 flex justify-between gap-2">
              <span>
                <strong>{o.name}</strong>{" "}
                <span className="text-slate-400">/{o.slug}</span>
              </span>
              <span className="text-xs text-slate-500 capitalize">{o.plan}</span>
            </li>
          ))}
          {orgs.length === 0 && <li className="px-3 py-3 text-slate-400">No orgs yet</li>}
        </ul>
      </div>

      <div>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Search residents…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" onClick={() => load()} className="text-sm border rounded-lg px-3 py-1.5">
            Search
          </button>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Residents ({residents.length})
        </div>
        <ul className="bg-white border rounded-xl divide-y max-h-56 overflow-y-auto text-sm">
          {residents.map((r) => (
            <li key={r.id} className="px-3 py-2 flex justify-between items-center gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.full_name || r.email}</div>
                <div className="text-xs text-slate-400 truncate">{r.email}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleResident(r.id, !r.is_active)}
                className={`text-xs shrink-0 px-2 py-1 rounded-lg border ${
                  r.is_active
                    ? "border-red-200 text-red-700 bg-red-50"
                    : "border-emerald-200 text-emerald-700 bg-emerald-50"
                }`}
              >
                {r.is_active ? "Suspend" : "Activate"}
              </button>
            </li>
          ))}
          {residents.length === 0 && <li className="px-3 py-3 text-slate-400">No residents</li>}
        </ul>
      </div>

      {busy && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Working…
        </div>
      )}
    </div>
  );
}
