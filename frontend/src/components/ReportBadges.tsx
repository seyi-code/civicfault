import type { FaultReport } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Building2, Globe2, User, Sparkles } from "lucide-react";

/**
 * STATUS = workflow (pending → resolved).
 * Filed By =
 *   Workspace — tagged to an org (org_slug / organization_id)
 *   Resident  — filed while logged in as resident (reporter_id)
 *   Community — guest / public, no org tag
 *
 * Priority: Workspace > Resident > Community
 * (org-tagged reports stay Workspace even if a resident filed them)
 */
export function filedByLabel(report: FaultReport): "Workspace" | "Resident" | "Community" {
  if (report.organization_id != null) return "Workspace";
  if (report.reporter_id != null) return "Resident";
  return "Community";
}

export function ReportBadges({
  report,
  compact = false,
}: {
  report: FaultReport;
  compact?: boolean;
}) {
  const filedBy = filedByLabel(report);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Status</span>
        <StatusBadge status={report.status} />
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Filed by</span>
        {filedBy === "Workspace" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-800 border-violet-200">
            <Building2 className="w-3 h-3" />
            Workspace
          </span>
        )}
        {filedBy === "Resident" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
            <User className="w-3 h-3" />
            Resident
          </span>
        )}
        {filedBy === "Community" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-sky-50 text-sky-800 border-sky-200">
            <Globe2 className="w-3 h-3" />
            Community
          </span>
        )}
      </span>

      {report.is_overdue && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </span>
      )}

      {report.severity && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
            report.severity === "high" || report.severity === "critical"
              ? "bg-red-50 text-red-800 border-red-200"
              : report.severity === "medium"
                ? "bg-orange-50 text-orange-800 border-orange-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          {report.severity}
        </span>
      )}

      {!compact && report.confidence != null && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-50 text-slate-600 border-slate-200">
          <Sparkles className="w-3 h-3" />
          AI {Math.round(report.confidence * 100)}%
        </span>
      )}
    </div>
  );
}
