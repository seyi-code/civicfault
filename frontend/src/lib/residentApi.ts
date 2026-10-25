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
  return res.json() as Promise<{ id: number; email: string; full_name?: string; phone?: string }>;
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
