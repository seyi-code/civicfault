"use client";

import { FormEvent, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

function AcceptForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/orgs/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, full_name: fullName || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Accept failed");
      setOk(true);
      setTimeout(() => router.push("/authority"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-600">Missing invite token in URL.</p>;
  }

  if (ok) {
    return <p className="text-emerald-700">Invite accepted — redirecting to sign in…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-white border rounded-2xl p-5">
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        type="password"
        required
        minLength={8}
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="Choose password (min 8)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold"
      >
        {busy ? "…" : "Join workspace"}
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Accept team invite</h1>
      <p className="text-sm text-slate-500 mb-6">Set your password to join the organization.</p>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <AcceptForm />
      </Suspense>
    </div>
  );
}
