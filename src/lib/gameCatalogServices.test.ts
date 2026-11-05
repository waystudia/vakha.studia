import { describe, expect, it } from "vitest";
import { GAME_CATALOG_CATEGORY, GAME_CATALOG_SERVICE_IDS, gameCatalogServices } from "./gameCatalogServices";

describe("game catalog services", () => {
  it("builds four stable A4 photo services with bundled previews", () => {
    const items = gameCatalogServices("owner-1", "https://studio.example/app/");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.source_id)).toEqual([...GAME_CATALOG_SERVICE_IDS]);
    expect(items.map((item) => item.gender)).toEqual(["boys", "boys", "boys", "girls"]);
    items.forEach((item) => {
      expect(item.owner_id).toBe("owner-1");
      expect(item.category).toBe(GAME_CATALOG_CATEGORY);
      expect(item.type).toBe("photo");
      expect(item.price).toBe(350);
      expect(item.parent_preview_mode).toBe("print");
      expect(item.preview_url).toMatch(/^https:\/\/studio\.example\/app\/catalog-games\/.+\.webp$/);
      expect(item.original_url).toMatch(/^https:\/\/studio\.example\/app\/catalog-games\/originals\/.+\.png$/);
    });
  });
});
