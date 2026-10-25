import type { FaultReport, FaultReportList, Organization } from "@/types";

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

export async function fetchWorkspaceReports(token: string): Promise<FaultReportList> {
  const res = await fetch(`${API_BASE}/api/v1/reports/workspace`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load workspace (${res.status})`);
  return res.json();
}

export async function createReport(form: FormData): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports`, { method: "POST", body: form });
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

export async function fetchMe(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not load profile");
  return res.json() as Promise<{
    id: number;
    email: string;
    full_name?: string;
    organization?: string;
    role: string;
    plan: string;
  }>;
}

export async function updateProfile(
  token: string,
  body: {
    full_name?: string;
    organization?: string;
    current_password?: string;
    new_password?: string;
  }
) {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Profile update failed");
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

export async function initPayment(
  token: string,
  plan_key = "authority_monthly",
  provider: "paystack" | "flutterwave" = "paystack"
) {
  const res = await fetch(`${API_BASE}/api/v1/billing/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_key,
      provider,
      callback_url:
        typeof window !== "undefined"
          ? `${window.location.origin}/authority?paid=1&provider=${provider}`
          : undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not start payment");
  return data as { authorization_url: string; reference: string; provider: string };
}

export async function verifyPayment(
  token: string,
  reference: string,
  provider: "paystack" | "flutterwave" = "paystack"
) {
  const res = await fetch(`${API_BASE}/api/v1/billing/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reference, provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Verification failed");
  return data;
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

export async function fetchMyOrg(token: string): Promise<Organization | null> {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 200) {
    const data = await res.json();
    return data || null;
  }
  return null;
}

export async function createOrg(
  token: string,
  body: { name: string; slug: string; visibility?: string; sla_hours?: number; notify_phone?: string }
) {
  const res = await fetch(`${API_BASE}/api/v1/orgs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not create organization");
  return data as Organization;
}

export async function updateMyOrg(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Update failed");
  return data as Organization;
}

export async function sendDigest(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me/digest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Digest failed");
  return data;
}

export async function fetchOrgStats(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export { API_BASE };
