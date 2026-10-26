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
  visibility?: string;
  is_active?: boolean;
  notify_phone?: string | null;
};

type ResidentRow = {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
};

type StaffRow = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
  organization_id?: number | null;
  organization_name?: string | null;
  organization_slug?: string | null;
  plan: string;
  is_active: boolean;
};

export function PlatformAdminPanel({ token }: { token: string }) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [qResidents, setQResidents] = useState("");
  const [qOrgs, setQOrgs] = useState("");
  const [qStaff, setQStaff] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planEmail, setPlanEmail] = useState("");
  const [plan, setPlan] = useState("authority");
  const [planDays, setPlanDays] = useState(30);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [editOrgId, setEditOrgId] = useState<number | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgPlan, setEditOrgPlan] = useState("free");
  const [editOrgSla, setEditOrgSla] = useState(72);
  const [editStaffId, setEditStaffId] = useState<number | null>(null);
  const [editStaffRole, setEditStaffRole] = useState("manager");
  const [editStaffOrgId, setEditStaffOrgId] = useState<string>("");

  async function load(orgQ?: string, staffQ?: string, resQ?: string) {
    setError(null);
    try {
      const oq = orgQ ?? qOrgs;
      const sq = staffQ ?? qStaff;
      const rq = resQ ?? qResidents;
      const orgQs = oq.trim() ? `?q=${encodeURIComponent(oq.trim())}` : "";
      const staffQs = sq.trim() ? `?q=${encodeURIComponent(sq.trim())}` : "";
      const [oRes, rList, sRes, me] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/organizations${orgQs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        adminListResidents(token, rq || undefined),
        fetch(`${API_BASE}/api/v1/admin/staff${staffQs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchMe(token),
      ]);
      if (!oRes.ok) {
        // fallback legacy list
        const legacy = await fetch(`${API_BASE}/api/v1/orgs/admin/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!legacy.ok) throw new Error("Could not load organizations");
        setOrgs(await legacy.json());
      } else {
        setOrgs(await oRes.json());
      }
      setResidents(rList);
      if (sRes.ok) setStaff(await sRes.json());
      else setStaff([]);
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
        "Platform admin already has full system access — grant plans to workspace staff only."
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
      setInfo(`Granted ${data.plan} to ${data.email} for ${planDays} days`);
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

  async function saveOrg(e: FormEvent) {
    e.preventDefault();
    if (editOrgId == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/organizations/${editOrgId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editOrgName,
          plan: editOrgPlan,
          sla_hours: editOrgSla,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, "Org update failed"));
      setInfo(`Updated ${data.name}`);
      setEditOrgId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Org update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateOrg(id: number, name: string) {
    if (!confirm(`Deactivate organization “${name}”? Reports stay; workspace is hidden for new links.`))
      return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/organizations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiError(data, "Deactivate failed"));
      }
      setInfo(`Deactivated ${name}`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveStaff(e: FormEvent) {
    e.preventDefault();
    if (editStaffId == null) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { role: editStaffRole };
      if (editStaffOrgId === "") body.clear_organization = true;
      else if (editStaffOrgId) body.organization_id = Number(editStaffOrgId);
      const res = await fetch(`${API_BASE}/api/v1/admin/staff/${editStaffId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, "Staff update failed"));
      setInfo(`Updated ${data.email}`);
      setEditStaffId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Staff update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateStaff(id: number, email: string) {
    if (!confirm(`Deactivate staff ${email}? They will not be able to sign in.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/staff/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(formatApiError(data, "Deactivate failed"));
      }
      setInfo(`Deactivated ${email}`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
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
        Full system access is tied to your <strong>admin role</strong>, not a paid plan. Manage orgs,
        staff, and residents here.
      </p>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      {info && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{info}</div>}

      <form onSubmit={grantPlan} className="bg-white border rounded-xl p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase">Grant plan to workspace staff</div>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Staff email — not platform admin"
          value={planEmail}
          onChange={(e) => setPlanEmail(e.target.value)}
          required
        />
        {targetIsSelfAdmin && (
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
            That email is platform admin — pick org staff instead.
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
      </form>

      {/* Organizations */}
      <div>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Search organizations…"
            value={qOrgs}
            onChange={(e) => setQOrgs(e.target.value)}
          />
          <button
            type="button"
            onClick={() => load(qOrgs, qStaff, qResidents)}
            className="text-sm border rounded-lg px-3 py-1.5"
          >
            Search
          </button>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Organizations ({orgs.length})
        </div>
        {editOrgId != null && (
          <form onSubmit={saveOrg} className="mb-2 bg-white border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold">Edit organization</div>
            <input
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              value={editOrgName}
              onChange={(e) => setEditOrgName(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <select
                className="border rounded-lg px-2 py-1.5 text-sm flex-1"
                value={editOrgPlan}
                onChange={(e) => setEditOrgPlan(e.target.value)}
              >
                <option value="free">free</option>
                <option value="authority">authority</option>
                <option value="enterprise">enterprise</option>
              </select>
              <input
                type="number"
                min={1}
                className="border rounded-lg px-2 py-1.5 text-sm w-20"
                value={editOrgSla}
                onChange={(e) => setEditOrgSla(Number(e.target.value) || 72)}
                title="SLA hours"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="text-sm bg-slate-900 text-white rounded-lg px-3 py-1.5">
                Save
              </button>
              <button type="button" className="text-sm text-slate-500" onClick={() => setEditOrgId(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <ul className="bg-white border rounded-xl divide-y max-h-56 overflow-y-auto text-sm">
          {orgs.map((o) => (
            <li key={o.id} className="px-3 py-2 space-y-1">
              <div className="flex justify-between gap-2">
                <span>
                  <strong>{o.name}</strong>{" "}
                  <span className="text-slate-400">/{o.slug}</span>
                  {o.is_active === false && (
                    <span className="ml-1 text-[10px] text-red-600 uppercase">inactive</span>
                  )}
                </span>
                <span className="text-xs text-slate-500 capitalize">{o.plan}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-violet-700"
                  onClick={() => {
                    setEditOrgId(o.id);
                    setEditOrgName(o.name);
                    setEditOrgPlan(o.plan || "free");
                    setEditOrgSla(o.sla_hours || 72);
                  }}
                >
                  Edit
                </button>
                {o.is_active !== false && (
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => deactivateOrg(o.id, o.name)}
                  >
                    Deactivate
                  </button>
                )}
                <a
                  className="text-slate-500"
                  href={`/?org=${o.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Resident link
                </a>
              </div>
            </li>
          ))}
          {orgs.length === 0 && <li className="px-3 py-3 text-slate-400">No organizations</li>}
        </ul>
      </div>

      {/* Staff */}
      <div>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Search staff…"
            value={qStaff}
            onChange={(e) => setQStaff(e.target.value)}
          />
          <button
            type="button"
            onClick={() => load(qOrgs, qStaff, qResidents)}
            className="text-sm border rounded-lg px-3 py-1.5"
          >
            Search
          </button>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Staff ({staff.length})</div>
        {editStaffId != null && (
          <form onSubmit={saveStaff} className="mb-2 bg-white border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold">Edit staff</div>
            <select
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              value={editStaffRole}
              onChange={(e) => setEditStaffRole(e.target.value)}
            >
              <option value="authority">authority (staff)</option>
              <option value="manager">manager</option>
              <option value="admin">admin (platform)</option>
            </select>
            <select
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              value={editStaffOrgId}
              onChange={(e) => setEditStaffOrgId(e.target.value)}
            >
              <option value="">No workspace</option>
              {orgs.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} (/{o.slug})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="text-sm bg-slate-900 text-white rounded-lg px-3 py-1.5">
                Save
              </button>
              <button type="button" className="text-sm text-slate-500" onClick={() => setEditStaffId(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <ul className="bg-white border rounded-xl divide-y max-h-56 overflow-y-auto text-sm">
          {staff.map((s) => (
            <li key={s.id} className="px-3 py-2">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.full_name || s.email}</div>
                  <div className="text-xs text-slate-400 truncate">{s.email}</div>
                  <div className="text-[11px] text-slate-500">
                    {s.role}
                    {s.organization_slug ? ` · ${s.organization_name} (/${s.organization_slug})` : " · no workspace"}
                    {!s.is_active ? " · inactive" : ""}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 text-xs mt-1">
                <button
                  type="button"
                  className="text-violet-700"
                  onClick={() => {
                    setEditStaffId(s.id);
                    setEditStaffRole(s.role || "manager");
                    setEditStaffOrgId(s.organization_id != null ? String(s.organization_id) : "");
                  }}
                >
                  Edit
                </button>
                {s.is_active && s.role !== "admin" && (
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => deactivateStaff(s.id, s.email)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </li>
          ))}
          {staff.length === 0 && (
            <li className="px-3 py-3 text-slate-400">No staff (redeploy API if empty after update)</li>
          )}
        </ul>
      </div>

      {/* Residents */}
      <div>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Search residents…"
            value={qResidents}
            onChange={(e) => setQResidents(e.target.value)}
          />
          <button
            type="button"
            onClick={() => load(qOrgs, qStaff, qResidents)}
            className="text-sm border rounded-lg px-3 py-1.5"
          >
            Search
          </button>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Residents ({residents.length})
        </div>
        <ul className="bg-white border rounded-xl divide-y max-h-48 overflow-y-auto text-sm">
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
