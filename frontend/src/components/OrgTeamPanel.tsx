"use client";

import { FormEvent, useEffect, useState } from "react";
import { Users, UserPlus, Loader2, Copy, Check } from "lucide-react";
import { API_BASE, createInvite, formatApiError } from "@/lib/api";
import { OrgFollowersPanel } from "@/components/OrgFollowersPanel";

type Member = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
};

export function OrgTeamPanel({ token, orgSlug }: { token: string; orgSlug?: string | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("authority");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadMembers() {
    fetch(`${API_BASE}/api/v1/orgs/me/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.items || []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadMembers();
  }, [token]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const data = await createInvite(token, inviteEmail.trim(), inviteRole);
      setInfo(`Invite created for ${inviteEmail}`);
      setLastToken(data.token || null);
      setInviteEmail("");
      loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!lastToken) return;
    try {
      await navigator.clipboard.writeText(lastToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const residentLink =
    typeof window !== "undefined" && orgSlug
      ? `${window.location.origin}/?org=${orgSlug}`
      : orgSlug
        ? `/?org=${orgSlug}`
        : null;

  return (
    <div className="space-y-4 mb-4">
      <OrgFollowersPanel token={token} />

      <div className="bg-white border rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" /> Invite staff
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Staff get Authority access for this workspace (not resident accounts). Role: authority or
          manager.
        </p>
        <form onSubmit={onInvite} className="space-y-2">
          <input
            type="email"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="colleague@estate.ug"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="authority">Authority (staff)</option>
            <option value="manager">Manager</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="w-full sm:w-auto text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-medium inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create invite
          </button>
        </form>
        {info && <p className="text-xs text-emerald-700 mt-2">{info}</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        {lastToken && (
          <div className="mt-2 flex items-center gap-2 text-xs bg-slate-50 border rounded-lg p-2">
            <code className="flex-1 truncate">Token: {lastToken}</code>
            <button type="button" onClick={copyToken} className="shrink-0 text-slate-600">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-2">
          Share the token; they accept via API or you create their staff login in Admin and attach to
          this org.
        </p>
      </div>

      {members.length > 0 && (
        <div className="bg-white border rounded-2xl p-4">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Staff on this workspace ({members.length})
          </h2>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <span className="truncate">{m.full_name || m.email}</span>
                <span className="text-xs text-slate-400 shrink-0">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {residentLink && (
        <p className="text-xs text-slate-500">
          Resident link (follow / report into workspace):{" "}
          <code className="bg-slate-100 px-1 rounded text-[11px]">{residentLink}</code>
        </p>
      )}
    </div>
  );
}
