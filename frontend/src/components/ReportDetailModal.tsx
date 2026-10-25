"use client";

import { useEffect, useState } from "react";
import { X, MapPin, Clock, ThumbsUp, Pin, Trash2, Pencil } from "lucide-react";
import type { FaultReport, FaultStatus } from "@/types";
import { ReportImage } from "@/components/ReportImage";
import { ReportBadges } from "@/components/ReportBadges";
import { ReportChat } from "@/components/ReportChat";
import { formatDateTime } from "@/lib/format";

const STATUSES: FaultStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "resolved",
  "rejected",
];

const CATEGORIES = [
  "pothole",
  "water_leak",
  "blocked_drain",
  "downed_power_line",
  "uncollected_waste",
  "broken_streetlight",
  "other",
];

const SEVERITIES = ["low", "medium", "high", "critical"];

export type ReportEditPayload = {
  description?: string | null;
  category?: string;
  address_label?: string | null;
  severity?: string | null;
  status?: string;
};

/** Shared detail sheet for public dashboard + authority console. */
export function ReportDetailModal({
  report,
  onClose,
  onUpvote,
  voted,
  voting,
  isPlatformAdmin,
  onPin,
  onStatus,
  onSoftDelete,
  onHardDelete,
  onEdit,
  busy,
}: {
  report: FaultReport;
  onClose: () => void;
  onUpvote?: (id: number) => void;
  voted?: boolean;
  voting?: boolean;
  isPlatformAdmin?: boolean;
  onPin?: (id: number, pinned: boolean) => void;
  onStatus?: (id: number, status: string) => void;
  onSoftDelete?: (id: number) => void;
  onHardDelete?: (id: number) => void;
  onEdit?: (id: number, body: ReportEditPayload) => Promise<void> | void;
  busy?: boolean;
}) {
  const pinned = !!report.is_pinned;
  const showWorkflow = typeof onStatus === "function";
  const showSoftDelete = typeof onSoftDelete === "function";
  const showPin = typeof onPin === "function";
  const canEdit = typeof onEdit === "function";

  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(report.category);
  const [description, setDescription] = useState(report.description || "");
  const [address, setAddress] = useState(report.address_label || "");
  const [severity, setSeverity] = useState(report.severity || "");
  const [status, setStatus] = useState(report.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategory(report.category);
    setDescription(report.description || "");
    setAddress(report.address_label || "");
    setSeverity(report.severity || "");
    setStatus(report.status);
    setEditing(false);
  }, [report]);

  async function saveEdit() {
    if (!onEdit) return;
    setSaving(true);
    try {
      await onEdit(report.id, {
        category,
        description: description.trim() || null,
        address_label: address.trim() || null,
        severity: severity || null,
        status,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

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
        <div className="sticky top-0 bg-white border-b border-slate-100 flex justify-between items-center px-4 py-3 z-10 gap-2">
          <h2 className="font-semibold text-slate-900 capitalize truncate">
            {report.category.replace(/_/g, " ")}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <ReportImage path={report.image_url} className="w-full h-52 object-cover" />

        <div className="p-4 space-y-3">
          {editing && canEdit ? (
            <div className="space-y-3 border border-amber-100 bg-amber-50/40 rounded-xl p-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
                <select
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Place / street</label>
                <input
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Buziga Road near junction"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Severity</label>
                  <select
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="">—</option>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
                  <select
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FaultStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving || busy}
                  onClick={saveEdit}
                  className="flex-1 text-sm font-medium bg-slate-900 text-white rounded-xl py-2.5 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                  className="text-sm border border-slate-200 rounded-xl px-4 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <ReportBadges report={report} />

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {report.hours_open != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {report.hours_open}h open
                    {report.sla_hours ? ` · SLA ${report.sla_hours}h` : ""}
                  </span>
                )}
                {pinned && (
                  <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
              </div>

              {report.description && (
                <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
              )}

              <div className="text-sm text-slate-600">
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
                  <dd className="font-medium text-slate-700">{formatDateTime(report.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Updated</dt>
                  <dd className="font-medium text-slate-700">{formatDateTime(report.updated_at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Resolved</dt>
                  <dd className="font-medium text-slate-700">{formatDateTime(report.resolved_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Upvotes</dt>
                  <dd className="font-medium text-slate-700">{report.upvote_count || 0}</dd>
                </div>
                {report.organization_id != null && (
                  <div>
                    <dt className="text-slate-400">Org ID</dt>
                    <dd className="font-medium text-slate-700">#{report.organization_id}</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          {onUpvote && !editing && (
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

          {showPin && onPin && !editing && (
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
              {pinned ? "Unpin report" : isPlatformAdmin ? "Pin report (platform admin)" : "Pin for priority"}
            </button>
          )}

          {showWorkflow && onStatus && !editing && (
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
          )}

          {showSoftDelete && onSoftDelete && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm("Hide this report from public view? (soft-delete → rejected)")) {
                  onSoftDelete(report.id);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-sm border border-red-200 text-red-700 bg-red-50 rounded-xl py-2.5 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Soft-delete (reject & hide)
            </button>
          )}

          {isPlatformAdmin && onHardDelete && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm("PERMANENTLY delete this report? This cannot be undone.")) {
                  onHardDelete(report.id);
                }
              }}
              className="w-full text-xs text-red-500 underline text-center"
            >
              Platform admin: hard delete
            </button>
          )}

          {!editing && <ReportChat reportId={report.id} />}
        </div>
      </div>
    </div>
  );
}
