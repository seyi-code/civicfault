import type { FaultReport } from "@/types";
import { API_BASE, formatApiError } from "@/lib/api";

export async function registerResident(body: {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/residents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Registration failed"));
  return data;
}

export async function loginResident(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/residents/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Login failed"));
  return data as { access_token: string; role: string };
}

export async function fetchResidentMe(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/residents/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not load resident profile");
  return res.json() as Promise<{
    id: number;
    email: string;
    full_name?: string;
    phone?: string;
    is_active?: boolean;
  }>;
}

export async function updateResidentProfile(
  token: string,
  body: {
    full_name?: string;
    phone?: string;
    current_password?: string;
    new_password?: string;
  }
) {
  const res = await fetch(`${API_BASE}/api/v1/residents/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Profile update failed"));
  return data as {
    id: number;
    email: string;
    full_name?: string;
    phone?: string;
  };
}

export async function fetchMyResidentReports(token: string): Promise<FaultReport[]> {
  const res = await fetch(`${API_BASE}/api/v1/residents/me/reports`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load your reports");
  return res.json();
}

export async function claimReport(reportId: number, token: string): Promise<FaultReport> {
  const res = await fetch(`${API_BASE}/api/v1/residents/me/claim/${reportId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Could not link report to your account"));
  return data;
}

export type WorkspaceFollow = { organization_id: number; slug: string; name: string };

export async function fetchFollows(token: string): Promise<WorkspaceFollow[]> {
  const res = await fetch(`${API_BASE}/api/v1/residents/me/follows`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not load follows");
  return res.json();
}

export async function followWorkspace(token: string, orgSlug: string): Promise<WorkspaceFollow> {
  const res = await fetch(`${API_BASE}/api/v1/residents/me/follows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ org_slug: orgSlug }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Follow failed"));
  return data;
}

export async function unfollowWorkspace(token: string, orgSlug: string) {
  const res = await fetch(
    `${API_BASE}/api/v1/residents/me/follows/${encodeURIComponent(orgSlug)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(formatApiError(data, "Unfollow failed"));
  }
}

export async function adminListResidents(token: string, q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/residents/admin${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not list residents");
  return res.json() as Promise<
    { id: number; email: string; full_name?: string; phone?: string; is_active: boolean }[]
  >;
}

export async function adminSetResidentActive(
  token: string,
  residentId: number,
  is_active: boolean
) {
  const res = await fetch(`${API_BASE}/api/v1/residents/admin/${residentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_active }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Update failed"));
  return data;
}
