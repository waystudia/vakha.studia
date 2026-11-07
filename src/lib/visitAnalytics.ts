export type PublicPageKind = "class" | "catalog";

export function trackPublicVisit(token: string, pageKind: PublicPageKind) {
  if (!token || typeof window === "undefined" || !navigator.onLine) return;
  const marker = `kz-visit:${pageKind}:${token}`;
  try {
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");
  } catch { /* Privacy modes can disable storage; analytics remains best-effort. */ }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return;
  void fetch(`${supabaseUrl}/functions/v1/track-public-visit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, pageKind }),
    keepalive: true,
  }).catch(() => undefined);
}
