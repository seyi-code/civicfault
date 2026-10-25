"use client";

import { X, MapPin, Clock, Trash2, Pin } from "lucide-react";
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
  onPin,
  onSoftDelete,
  onHardDelete,
  busy,
}: {
  report: FaultReport;
  role: string;
  onClose: () => void;
  onStatus: (id: number, status: string) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onSoftDelete: (id: number) => void;
  onHardDelete?: (id: number) => void;
  busy?: boolean;
}) {
  const isPlatformAdmin = role === "admin";
  const pinned = !!report.is_pinned;

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
            {pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <Pin className="w-3 h-3" /> Pinned
              </span>
            )}
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

          {onPin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPin(report.id, !pinned)}
              className={`w-full inline-flex items-center justify-center gap-2 text-sm rounded-xl py-2.5 font-medium border ${
                pinned
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <Pin className="w-4 h-4" />
              {pinned ? "Unpin (remove priority)" : "Pin for priority visibility"}
            </button>
          )}

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
          </div>
        </div>
      </div>
    </div>
  );
}
