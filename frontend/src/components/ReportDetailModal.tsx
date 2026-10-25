"use client";

import { X, MapPin, Clock, ThumbsUp } from "lucide-react";
import type { FaultReport } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";

export function ReportDetailModal({
  report,
  onClose,
  onUpvote,
  voted,
  voting,
}: {
  report: FaultReport;
  onClose: () => void;
  onUpvote?: (id: number) => void;
  voted?: boolean;
  voting?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 flex justify-between items-center px-4 py-3 z-10">
          <h2 className="font-semibold text-slate-900 capitalize">
            {report.category.replace(/_/g, " ")}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <ReportImage path={report.image_url} className="w-full h-52 object-cover" />

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            {report.confidence != null && (
              <span className="text-xs text-slate-400">AI {Math.round(report.confidence * 100)}%</span>
            )}
            {report.hours_open != null && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" /> {report.hours_open}h open
              </span>
            )}
            {report.is_overdue && (
              <span className="text-xs font-medium text-red-600">Overdue</span>
            )}
          </div>

          {report.description && (
            <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
          )}

          <div className="text-sm text-slate-600 space-y-1">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
              <div>
                <div>{report.address_label || "Location"}</div>
                <div className="text-xs text-slate-400">
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </div>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
            <div>
              <dt className="text-slate-400">Report ID</dt>
              <dd className="font-medium text-slate-700">#{report.id}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Cluster</dt>
              <dd className="font-medium text-slate-700">#{report.cluster_id ?? report.id}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Filed</dt>
              <dd className="font-medium text-slate-700">{new Date(report.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Updated</dt>
              <dd className="font-medium text-slate-700">{new Date(report.updated_at).toLocaleString()}</dd>
            </div>
            {report.resolved_at && (
              <div className="col-span-2">
                <dt className="text-slate-400">Resolved</dt>
                <dd className="font-medium text-slate-700">{new Date(report.resolved_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {onUpvote && (
            <button
              type="button"
              disabled={voted || voting}
              onClick={() => onUpvote(report.id)}
              className={`w-full inline-flex items-center justify-center gap-2 text-sm rounded-xl px-3 py-2.5 border ${
                voted
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-slate-900 text-white border-slate-900"
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              {voted ? "You confirmed this" : "I see this too"}
              <span className="opacity-70">{report.upvote_count || 0}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
