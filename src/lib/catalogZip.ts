import JSZip from "jszip";
import type { CatalogZipItem } from "./types";

interface CrmCatalogService {
  id?: string;
  name?: string;
  price?: number | string;
  shortDescription?: string;
  description?: string;
  category?: string;
  gender?: string;
  popular?: boolean;
  previewImage?: string;
  previewVideo?: string;
}

interface CrmCatalogFile {
  title?: string;
  exportedAt?: string;
  services?: CrmCatalogService[];
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\//, "");
}

function inferType(service: CrmCatalogService) {
  const text = `${service.name || ""} ${service.category || ""}`.toLowerCase();
  if (text.includes("интервью")) return "interview";
  if (text.includes("видео")) return "video";
  if (text.includes("ai") || text.includes("ии") || text.includes("образ")) return "ai";
  return "photo";
}

function mimeForPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
  }[extension || ""] || "application/octet-stream";
}

function blobPart(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function parseCrmCatalogZip(file: File): Promise<CatalogZipItem[]> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Выберите ZIP-файл каталога CRM Photo");
  }

  const zip = await JSZip.loadAsync(file);
  const catalogEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && normalizePath(entry.name).endsWith("catalog.json"),
  );
  if (!catalogEntry) throw new Error("В архиве не найден catalog.json");

  let catalog: CrmCatalogFile;
  try {
    catalog = JSON.parse(await catalogEntry.async("text")) as CrmCatalogFile;
  } catch {
    throw new Error("Файл catalog.json повреждён");
  }

  if (!Array.isArray(catalog.services)) {
    throw new Error("В catalog.json отсутствует список services");
  }

  const seen = new Set<string>();
  const items: CatalogZipItem[] = [];
  for (const [index, service] of catalog.services.entries()) {
    const sourceId = String(service.id || `crm-service-${index + 1}`).trim();
    const name = String(service.name || "").trim();
    if (!name || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const previewImagePath = normalizePath(service.previewImage || "");
    const previewVideoPath = normalizePath(service.previewVideo || "");
    const imageEntry = previewImagePath ? zip.file(previewImagePath) : null;
    const videoEntry = previewVideoPath ? zip.file(previewVideoPath) : null;

    items.push({
      sourceId,
      name,
      price: Math.max(0, Number(service.price || 0)),
      shortDescription: String(service.shortDescription || "").trim(),
      description: String(service.description || "").trim(),
      category: String(service.category || "").trim(),
      type: inferType(service),
      popular: Boolean(service.popular),
      previewImagePath,
      previewVideoPath,
      previewImage: imageEntry
        ? new Blob([blobPart(await imageEntry.async("uint8array"))], { type: mimeForPath(previewImagePath) })
        : undefined,
      previewVideo: videoEntry
        ? new Blob([blobPart(await videoEntry.async("uint8array"))], { type: mimeForPath(previewVideoPath) })
        : undefined,
    });
  }

  if (!items.length) throw new Error("В архиве нет доступных услуг");
  return items;
}
