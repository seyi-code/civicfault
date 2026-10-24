"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchReports } from "@/lib/api";
import type { FaultReport } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";
import { Loader2 } from "lucide-react";

const ReportsMap = dynamic(
  () => import("@/components/ReportsMap").then((m) => m.ReportsMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 sm:h-96 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
    ),
  }
);

export default function DashboardPage() {
  const [items, setItems] = useState<FaultReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports()
      .then((data) => {
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Public dashboard</h1>
      <p className="text-slate-500 text-sm mb-6">
        {loading ? "Loading…" : `${total} public report${total === 1 ? "" : "s"}`}
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
          <li
            key={r.id}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row"
          >
            <ReportImage
              path={r.image_url}
              className="sm:w-40 h-36 sm:h-auto object-cover w-full"
            />
            <div className="p-4 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold capitalize">
                  {r.category.replace(/_/g, " ")}
                </span>
                <StatusBadge status={r.status} />
                {r.confidence != null && (
                  <span className="text-xs text-slate-400">
                    AI {Math.round(r.confidence * 100)}%
                  </span>
                )}
              </div>
              {r.description && (
                <p className="text-sm text-slate-600 mb-2">{r.description}</p>
              )}
              <p className="text-xs text-slate-400">
                #{r.id} · {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && !error && (
        <p className="text-center text-slate-400 py-12">No public reports yet.</p>
      )}
    </div>
  );
}
