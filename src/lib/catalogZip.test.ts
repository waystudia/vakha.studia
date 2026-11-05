import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseCrmCatalogZip } from "./catalogZip";

async function catalogFile(catalog: unknown) {
  const zip = new JSZip();
  zip.file("catalog.json", JSON.stringify(catalog));
  zip.file("assets/images/photo.png", new Uint8Array([137, 80, 78, 71]));
  zip.file("assets/originals/photo.png", new Uint8Array([137, 80, 78, 71, 13, 10]));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], "catalog_export.zip", { type: "application/zip" });
}

describe("CRM Photo catalog ZIP", () => {
  it("читает услуги и превью из реального формата catalog_export.zip", async () => {
    const file = await catalogFile({ services: [{ id: "photo", name: "Обычные фото", price: 400, gender: "girls", shortDescription: "Школьные снимки", previewImage: "assets/images/photo.png", originalImage: "assets/originals/photo.png", presentation: { parentPreviewMode: "print" } }] });
    const items = await parseCrmCatalogZip(file);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceId: "photo", name: "Обычные фото", price: 400, type: "photo", gender: "girls" });
    expect(items[0].previewImage?.type).toBe("image/png");
    expect(items[0].originalImage?.size).toBe(6);
    expect(items[0].parentPreviewMode).toBe("print");
  });

  it("keeps the preview bytes as an original fallback for older CRM archives", async () => {
    const file = await catalogFile({ services: [{ id: "legacy", name: "Старая услуга", previewImage: "assets/images/photo.png" }] });
    const [item] = await parseCrmCatalogZip(file);
    expect(item.originalImage?.size).toBe(item.previewImage?.size);
    expect(item.originalImagePath).toBe("");
  });

  it("отклоняет архив без catalog.json", async () => {
    const zip = new JSZip(); zip.file("readme.txt", "empty");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(parseCrmCatalogZip(new File([buffer], "bad.zip"))).rejects.toThrow("catalog.json");
  });

  it("сохраняет запрос CRM для создания образа в полном описании", async () => {
    const zip = new JSZip();
    zip.file("catalog.json", JSON.stringify({ services: [{
      id: "fighter",
      name: "Боец",
      description: "Спортивный образ.",
      prompt: "Сохрани лицо ребёнка и добавь перчатки.",
      previewImage: "fighter.webp",
    }] }));
    zip.file("fighter.webp", new Uint8Array([1, 2, 3]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const [item] = await parseCrmCatalogZip(new File([buffer], "catalog.zip"));
    expect(item.description).toContain("Запрос для создания образа:");
    expect(item.description).toContain("Сохрани лицо ребёнка и добавь перчатки.");
  });
});
