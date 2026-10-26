/** Offline report drafts for poor connectivity (meta only; photo re-picked on flush). */

export type OfflineDraft = {
  id: string;
  latitude: number;
  longitude: number;
  description?: string;
  org_slug?: string;
  created_at: string;
};

const KEY = "civicfault_offline_drafts";

export function listDrafts(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineDraft[]) : [];
  } catch {
    return [];
  }
}

/** Alias used by report form */
export function listQueued(): OfflineDraft[] {
  return listDrafts();
}

export function saveDraft(draft: Omit<OfflineDraft, "id" | "created_at">): OfflineDraft {
  const item: OfflineDraft = {
    ...draft,
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  const next = [item, ...listDrafts()].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
  return item;
}

/** Alias used by report form when offline */
export function enqueueMeta(draft: Omit<OfflineDraft, "id" | "created_at">): OfflineDraft {
  return saveDraft(draft);
}

export function removeDraft(id: string) {
  const next = listDrafts().filter((d) => d.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearDrafts() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
