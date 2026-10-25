"use client";

import { ReportDetailModal, type ReportEditPayload } from "@/components/ReportDetailModal";
import type { FaultReport } from "@/types";

export function AuthorityReportModal({
  report,
  role,
  onClose,
  onStatus,
  onPin,
  onSoftDelete,
  onHardDelete,
  onEdit,
  busy,
}: {
  report: FaultReport;
  role: string;
  onClose: () => void;
  onStatus: (id: number, status: string) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onSoftDelete: (id: number) => void;
  onHardDelete?: (id: number) => void;
  onEdit?: (id: number, body: ReportEditPayload) => Promise<void> | void;
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
      onEdit={onEdit}
      busy={busy}
    />
  );
}
