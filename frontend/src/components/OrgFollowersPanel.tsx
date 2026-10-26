"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { API_BASE } from "@/lib/api";

type Follower = {
  resident_id: number;
  email: string;
  full_name?: string | null;
  followed_at?: string | null;
};

export function OrgFollowersPanel({ token }: { token: string }) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/orgs/me/followers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 400) {
          setFollowers([]);
          return;
        }
        if (!res.ok) throw new Error("Could not load followers");
        setFollowers(await res.json());
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="mb-4 text-sm text-slate-400">Followers unavailable: {error}</div>
    );
  }

  return (
    <div className="mb-4 bg-white border rounded-2xl p-4">
      <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
        <Users className="w-4 h-4" /> Followers ({followers.length})
      </h2>
      {followers.length === 0 ? (
        <p className="text-xs text-slate-400">
          Residents who follow your workspace slug will appear here.
        </p>
      ) : (
        <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
          {followers.map((f) => (
            <li key={f.resident_id} className="flex justify-between gap-2">
              <span className="truncate">{f.full_name || f.email}</span>
              <span className="text-xs text-slate-400 shrink-0 truncate max-w-[40%]">{f.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
