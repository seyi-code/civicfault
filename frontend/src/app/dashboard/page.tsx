"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchReports, upvoteReport, pinReport, fetchMe } from "@/lib/api";
import type { FaultReport } from "@/types";
import { ReportImage } from "@/components/ReportImage";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { ReportBadges } from "@/components/ReportBadges";
import { Loader2, ThumbsUp, Pin } from "lucide-react";

const TOKEN_KEY = "civicfault_authority_token";

const ReportsMap = dynamic(
  () => import("@/components/ReportsMap").then((m) => m.ReportsMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 sm:h-96 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
    ),
  }
);

function placeLine(r: FaultReport) {
  if (r.address_label) return r.address_label;
  return `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`;
}

function getVoterHash(): string {
  if (typeof window === "undefined") return "anon";
  const key = "civicfault_voter";
  let h = localStorage.getItem(key);
  if (!h) {
    h = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, h);
  }
  return h;
}

export default function DashboardPage() {
  const [items, setItems] = useState<FaultReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [votingId, setVotingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<FaultReport | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    fetchReports()
      .then((data) => {
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    try {
      const raw = localStorage.getItem("civicfault_voted_ids");
      if (raw) setVoted(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      fetchMe(t)
        .then((me) => setIsPlatformAdmin(me.role === "admin"))
        .catch(() => setIsPlatformAdmin(false));
    }
  }, []);

  async function onUpvote(id: number) {
    if (voted[id] || votingId) return;
    setVotingId(id);
    setError(null);
    try {
      const updated = await upvoteReport(id, getVoterHash());
      setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSelected((cur) => (cur && cur.id === id ? updated : cur));
      const next = { ...voted, [id]: true };
      setVoted(next);
      localStorage.setItem("civicfault_voted_ids", JSON.stringify(next));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upvote failed";
      if (msg.toLowerCase().includes("already")) {
        const next = { ...voted, [id]: true };
        setVoted(next);
        localStorage.setItem("civicfault_voted_ids", JSON.stringify(next));
      } else setError(msg);
    } finally {
      setVotingId(null);
    }
  }

  async function onPin(id: number, pinned: boolean) {
    if (!token || !isPlatformAdmin) return;
    setPinBusy(true);
    setError(null);
    try {
      const updated = await pinReport(id, pinned, token);
      setItems((prev) => {
        const next = prev.map((r) => (r.id === id ? updated : r));
        // Pinned first
        return [...next].sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned));
      });
      setSelected((cur) => (cur && cur.id === id ? updated : cur));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Pin failed");
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Public dashboard</h1>
      <p className="text-slate-500 text-sm mb-6">
        {loading ? "Loading…" : `${total} public report${total === 1 ? "" : "s"}`}
        {isPlatformAdmin && (
          <span className="ml-2 text-violet-700 font-medium">· Platform admin can pin</span>
        )}
      </p>

      {!loading && items.length > 0 && (
        <div className="mb-8">
          <ReportsMap reports={items} />
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <ul className="space-y-4">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row hover:border-amber-300 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <ReportImage path={r.image_url} className="sm:w-40 h-36 sm:h-auto object-cover w-full" />
              <div className="p-4 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-semibold capitalize text-slate-900">
                    {r.category.replace(/_/g, " ")}
                  </span>
                  {r.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                </div>
                <ReportBadges report={r} />
                {r.description && (
                  <p className="text-sm text-slate-600 mt-2 mb-2 line-clamp-2">{r.description}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">{placeLine(r)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  #{r.id}
                  {r.hours_open != null ? ` · ${r.hours_open}h open` : ""} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
                <span
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpvote(r.id);
                  }}
                  className={`mt-3 inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 border ${
                    voted[r.id]
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  {voted[r.id] ? "Confirmed" : "I see this too"}
                  <span className="text-xs text-slate-400">{r.upvote_count || 0}</span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && !error && (
        <p className="text-center text-slate-400 py-12">No public reports yet.</p>
      )}

      {selected && (
        <ReportDetailModal
          report={selected}
          onClose={() => setSelected(null)}
          onUpvote={onUpvote}
          voted={!!voted[selected.id]}
          voting={votingId === selected.id}
          isPlatformAdmin={isPlatformAdmin}
          onPin={isPlatformAdmin ? onPin : undefined}
          busy={pinBusy}
        />
      )}
    </div>
  );
}
