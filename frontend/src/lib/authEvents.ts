/** Shared auth broadcast so SiteHeader updates without hard refresh. */

export const AUTH_EVENT = "civicfault-auth-changed";

export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}
