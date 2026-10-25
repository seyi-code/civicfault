import type { FaultReport, FaultReportList, Organization } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://civicfault-api.up.railway.app";

export function formatApiError(data: unknown, fallback = "Request failed"): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as { detail?: unknown; message?: unknown };
  const detail = d.detail ?? d.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as { msg?: string; loc?: unknown[]; type?: string };
          const where = Array.isArray(o.loc) ? o.loc.filter((x) => x !== "body").join(".") : "";
          return where ? `${where}: ${o.msg || o.type || "invalid"}` : o.msg || JSON.stringify(item);
        }
        return String(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return fallback;
}

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
  if (!res.ok) throw new Error(formatApiError(data, `Upload failed (${res.status})`));
  // Link to resident account if signed in
  if (typeof window !== "undefined" && data?.id) {
    const rt = localStorage.getItem("civicfault_resident_token");
    if (rt) {
      try {
        const claimRes = await fetch(`${API_BASE}/api/v1/residents/me/claim/${data.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${rt}` },
        });
        if (claimRes.ok) {
          return claimRes.json();
        }
      } catch {
        /* claim optional */
      }
    }
  }
  return data;
}

export async function editReport(
  reportId: number,
  body: {
    description?: string | null;
    category?: string;
    address_label?: string | null;
    severity?: string | null;
    status?: string;
  },
  token: string
): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Edit failed"));
  return data;
}

export async function fetchComments(reportId: number) {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/comments`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load discussion");
  return res.json() as Promise<{
    items: { id: number; report_id: number; author_label: string; is_staff: boolean; body: string; created_at: string }[];
    total: number;
  }>;
}

export async function postComment(
  reportId: number,
  body: { body: string; author_label?: string; author_hash?: string },
  token?: string
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Comment failed"));
  return data as {
    id: number;
    report_id: number;
    author_label: string;
    is_staff: boolean;
    body: string;
    created_at: string;
  };
}

export async function loginAuthority(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Login failed"));
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
  if (!res.ok) throw new Error(formatApiError(data, "Registration failed"));
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
  if (!res.ok) throw new Error(formatApiError(data, "Profile update failed"));
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
  if (!res.ok) throw new Error(formatApiError(data, "Status update failed"));
  return data;
}

export async function pinReport(
  reportId: number,
  isPinned: boolean,
  token: string
): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/pin`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_pinned: isPinned }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Pin update failed"));
  return data;
}

export async function deleteReport(reportId: number, token: string, hard = false) {
  const q = hard ? "?hard=true" : "";
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}${q}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(formatApiError(data, "Delete failed"));
  }
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
  if (!res.ok) throw new Error(formatApiError(data, "Could not start payment"));
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
  if (!res.ok) throw new Error(formatApiError(data, "Verification failed"));
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
  const slug = body.slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const res = await fetch(`${API_BASE}/api/v1/orgs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, slug }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Could not create organization"));
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
  if (!res.ok) throw new Error(formatApiError(data, "Update failed"));
  return data as Organization;
}

export async function sendDigest(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me/digest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Digest failed"));
  return data;
}

export async function fetchOrgStats(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function upvoteReport(reportId: number, voterHash: string): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/upvote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voter_hash: voterHash }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Upvote failed"));
  return data;
}

export async function createInvite(token: string, email: string, role = "authority") {
  const res = await fetch(`${API_BASE}/api/v1/orgs/me/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Invite failed"));
  return data as { accept_url: string; email: string; token: string };
}

// Resident helpers re-exported for convenience
export {
  registerResident,
  loginResident,
  fetchResidentMe,
  fetchMyResidentReports,
  claimReport,
} from "@/lib/residentApi";

export { API_BASE };
