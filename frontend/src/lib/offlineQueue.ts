/** Queue report FormData metadata when offline; flush when online. */

const KEY = "civicfault_offline_reports";

export type QueuedReport = {
  id: string;
  createdAt: string;
  // We cannot store File in JSON — keep description + coords; user re-attaches photo on flush if needed
  latitude: number;
  longitude: number;
  description?: string;
  org_slug?: string;
};

export function listQueued(): QueuedReport[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function enqueueMeta(item: Omit<QueuedReport, "id" | "createdAt">) {
  const list = listQueued();
  list.push({
    ...item,
    id: `q_${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeQueued(id: string) {
  const list = listQueued().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
