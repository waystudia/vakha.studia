import { supabase } from "./supabase";

export type PublicPageKind = "class" | "catalog";

export function trackPublicVisit(token: string, pageKind: PublicPageKind) {
  if (!token || typeof window === "undefined" || !navigator.onLine) return;
  const marker = `kz-visit:${pageKind}:${token}`;
  try {
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");
  } catch { /* Privacy modes can disable storage; analytics remains best-effort. */ }
  void supabase.functions.invoke("track-public-visit", { body: { token, pageKind } }).catch(() => undefined);
}
