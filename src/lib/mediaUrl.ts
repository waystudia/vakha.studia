const catalogMediaVersion = "20261027";

export function catalogMediaUrl(url: string) {
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${catalogMediaVersion}`;
}
