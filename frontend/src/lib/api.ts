const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://civicfault-api.up.railway.app";

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function fetchReports(page = 1) {
  const res = await fetch(
    `${API_BASE}/api/v1/reports?page=${page}&page_size=50&public_only=true`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
  return res.json();
}

export async function fetchClusters() {
  const res = await fetch(`${API_BASE}/api/v1/clusters?min_reports=1&limit=100`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load clusters (${res.status})`);
  return res.json();
}

export async function createReport(form: FormData) {
  const res = await fetch(`${API_BASE}/api/v1/reports`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Upload failed (${res.status})`);
  }
  return data;
}

export { API_BASE };
