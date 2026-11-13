const catalogMediaVersion = "20261027";

export function catalogMediaUrl(url: string) {
  if (!url) return "";
  if (import.meta.env.VITE_CRM_MODE === "true") return url; // Signed CRM/S3 URLs must remain byte-for-byte intact.
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${catalogMediaVersion}`;
}
