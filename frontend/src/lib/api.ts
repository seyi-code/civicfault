import type { FaultReport, FaultReportList, ClusterSummary } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://civicfault-api.up.railway.app";

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function fetchReports(page = 1): Promise<FaultReportList> {
  const res = await fetch(
    `${API_BASE}/api/v1/reports?page=${page}&page_size=100&public_only=true`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
  return res.json();
}

export async function fetchClusters(): Promise<ClusterSummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/clusters?min_reports=1&limit=100`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load clusters (${res.status})`);
  return res.json();
}

export async function createReport(form: FormData): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return data;
}

export async function loginAuthority(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data as { access_token: string; token_type: string; role: string; plan: string };
}

export async function registerAuthority(body: {
  email: string;
  password: string;
  full_name?: string;
  organization?: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Registration failed");
  return data;
}

export async function updateReportStatus(
  reportId: number,
  status: string,
  token: string
): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Status update failed");
  return data;
}

export async function initPaystack(token: string, plan_key = "authority_monthly") {
  const res = await fetch(`${API_BASE}/api/v1/billing/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_key,
      callback_url: typeof window !== "undefined" ? `${window.location.origin}/authority?paid=1` : undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not start payment");
  return data as { authorization_url: string; reference: string };
}

export async function verifyPaystack(token: string, reference: string) {
  const res = await fetch(`${API_BASE}/api/v1/billing/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reference }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Verification failed");
  return data;
}

export function exportCsvUrl(token: string) {
  // Browser cannot set Authorization on <a download>, so we fetch blob in UI instead
  return `${API_BASE}/api/v1/export/reports.csv?token=${encodeURIComponent(token)}`;
}

export async function downloadReportsCsv(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/export/reports.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `civicfault_reports_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { API_BASE };
