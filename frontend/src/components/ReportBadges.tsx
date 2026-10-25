import type { FaultReport } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Building2, Globe2, Sparkles } from "lucide-react";

/**
 * Task badge = workflow status (pending → resolved).
 * Role badge = who the report belongs to (Community vs Workspace).
 */
export function ReportBadges({
  report,
  compact = false,
}: {
  report: FaultReport;
  compact?: boolean;
}) {
  const isWorkspace = report.organization_id != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Task */}
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Task</span>
        <StatusBadge status={report.status} />
      </span>

      {/* Role / scope */}
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Role</span>
        {isWorkspace ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-800 border-violet-200">
            <Building2 className="w-3 h-3" />
            Workspace
          </span>
        ) : (
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
