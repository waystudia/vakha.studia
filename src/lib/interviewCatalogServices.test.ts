import { describe, expect, it } from "vitest";
import { INTERVIEW_CATALOG_CATEGORY, INTERVIEW_CATALOG_SERVICE_IDS, interviewCatalogServices } from "./interviewCatalogServices";

describe("bundled interview services", () => {
  it("builds the exact CRM boy and girl interviews with separate horizontal originals and videos", () => {
    const items = interviewCatalogServices("owner", "https://example.test/vakha.studia/");
    expect(items.map((item) => item.source_id)).toEqual([...INTERVIEW_CATALOG_SERVICE_IDS]);
    expect(items.map((item) => item.gender)).toEqual(["boys", "girls"]);
    expect(items.map((item) => item.name)).toEqual(["Интервью", "Интервью ребенка"]);
    expect(items.every((item) => item.category === INTERVIEW_CATALOG_CATEGORY && item.price === 800)).toBe(true);
    expect(items[0].preview_video_url).toMatch(/interview-boy\.mp4$/);
    expect(items[1].preview_video_url).toMatch(/interview-girl\.mp4$/);
    expect(items.every((item) => item.preview_url.includes("catalog-interviews/"))).toBe(true);
    expect(items.every((item) => item.original_url.includes("-original.jpg"))).toBe(true);
  });
});
