"use client";

import { X, MapPin, Clock, Trash2 } from "lucide-react";
import type { FaultReport, FaultStatus } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportImage } from "@/components/ReportImage";

const STATUSES: FaultStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "resolved",
  "rejected",
];

export function AuthorityReportModal({
  report,
  role,
  onClose,
  onStatus,
  onSoftDelete,
  onHardDelete,
  busy,
}: {
  report: FaultReport;
  role: string;
  onClose: () => void;
  onStatus: (id: number, status: string) => void;
  onSoftDelete: (id: number) => void;
  onHardDelete?: (id: number) => void;
  busy?: boolean;
}) {
  const isPlatformAdmin = role === "admin";

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
          <h2 className="font-semibold capitalize">{report.category.replace(/_/g, " ")}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <ReportImage path={report.image_url} className="w-full h-48 object-cover" />

        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            {report.hours_open != null && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" /> {report.hours_open}h open
              </span>
            )}
            {report.is_overdue && <span className="text-xs font-medium text-red-600">Overdue</span>}
          </div>

          {report.description && <p className="text-sm text-slate-700">{report.description}</p>}

          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
            <div>
              <div>{report.address_label || "Location"}</div>
              <div className="text-xs text-slate-400">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500 border-t pt-3">
            <div>
              <dt className="text-slate-400">ID</dt>
              <dd className="font-medium text-slate-700">#{report.id}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Filed</dt>
              <dd className="font-medium text-slate-700">{new Date(report.created_at).toLocaleString()}</dd>
            </div>
          </dl>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Update status</label>
            <select
              className="w-full text-sm border rounded-lg px-3 py-2"
              value={report.status}
              disabled={busy}
              onChange={(e) => onStatus(report.id, e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 border-t pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm("Hide this report from public view? (soft-delete → rejected)")) {
                  onSoftDelete(report.id);
                }
              }}
              className="inline-flex items-center justify-center gap-2 text-sm border border-red-200 text-red-700 bg-red-50 rounded-xl py-2.5 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Soft-delete (reject & hide)
            </button>
            {isPlatformAdmin && onHardDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm("PERMANENTLY delete this report? This cannot be undone.")) {
                    onHardDelete(report.id);
                  }
                }}
                className="text-xs text-red-500 underline text-center"
              >
                Platform admin: hard delete
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center">
              Soft-delete keeps an audit trail. Hard delete is platform-admin only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
