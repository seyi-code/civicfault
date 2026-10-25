"use client";

/**
 * Authority console uses the same rich detail sheet as the public dashboard.
 * Staff actions (status / pin / delete) are passed through.
 */
import { ReportDetailModal } from "@/components/ReportDetailModal";
import type { FaultReport } from "@/types";

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
  return (
    <ReportDetailModal
      report={report}
      onClose={onClose}
      isPlatformAdmin={role === "admin"}
      onStatus={onStatus}
      onPin={onPin}
      onSoftDelete={onSoftDelete}
      onHardDelete={onHardDelete}
      busy={busy}
    />
  );
}
