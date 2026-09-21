import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseCrmCatalogZip } from "./catalogZip";

async function catalogFile(catalog: unknown) {
  const zip = new JSZip();
  zip.file("catalog.json", JSON.stringify(catalog));
  zip.file("assets/images/photo.png", new Uint8Array([137, 80, 78, 71]));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], "catalog_export.zip", { type: "application/zip" });
}

describe("CRM Photo catalog ZIP", () => {
  it("читает услуги и превью из реального формата catalog_export.zip", async () => {
    const file = await catalogFile({ services: [{ id: "photo", name: "Обычные фото", price: 400, gender: "girls", shortDescription: "Школьные снимки", previewImage: "assets/images/photo.png" }] });
    const items = await parseCrmCatalogZip(file);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceId: "photo", name: "Обычные фото", price: 400, type: "photo", gender: "girls" });
    expect(items[0].previewImage?.type).toBe("image/png");
  });

  it("отклоняет архив без catalog.json", async () => {
    const zip = new JSZip(); zip.file("readme.txt", "empty");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await expect(parseCrmCatalogZip(new File([buffer], "bad.zip"))).rejects.toThrow("catalog.json");
  });
});
