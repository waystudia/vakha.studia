import { describe, expect, it } from "vitest";
import { catalogPreviewUrl } from "./catalogPreview";

describe("catalogPreviewUrl", () => {
  it("keeps the uploaded preview when it exists", () => {
    expect(catalogPreviewUrl({ name: "Фото", preview_url: "https://example.test/photo.webp" })).toBe("https://example.test/photo.webp");
  });

  it("restores the bundled WebP used by selected child cards", () => {
    expect(catalogPreviewUrl({ name: "Гоночный чемпион", preview_url: "" })).toContain("catalog-fallbacks/child-boy-racing-champion.webp");
  });
});
