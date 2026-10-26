"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlatformAdminPanel } from "@/components/PlatformAdminPanel";
import { OrgFollowersPanel } from "@/components/OrgFollowersPanel";
import { fetchMe, fetchMyOrg } from "@/lib/api";

const TOKEN_KEY = "civicfault_authority_token";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [hasOrg, setHasOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setError("Sign in on Authority first as platform admin.");
      return;
    }
    setToken(t);
    Promise.all([fetchMe(t), fetchMyOrg(t)])
      .then(([me, org]) => {
        if (me.role !== "admin") {
          setError("Platform admin role required.");
          setOk(false);
        } else {
          setOk(true);
          setHasOrg(!!org);
        }
      })
      .catch(() => setError("Session invalid — sign in on Authority."));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Platform admin</h1>
      <p className="text-sm text-slate-500 mb-4">
        Orgs, residents, grant plans.{" "}
        <Link href="/authority" className="underline">
          Back to Authority
        </Link>
      </p>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>}
      {ok && token && <PlatformAdminPanel token={token} />}
      {ok && token && hasOrg && <OrgFollowersPanel token={token} />}
    </div>
  );
}
