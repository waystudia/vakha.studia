import { describe, expect, it } from "vitest";
import { INTERVIEW_CATALOG_CATEGORY, INTERVIEW_CATALOG_SERVICE_IDS, interviewCatalogServices } from "./interviewCatalogServices";

describe("bundled interview services", () => {
  it("builds distinct boy and girl cards without substituting the boy video for the girl", () => {
    const items = interviewCatalogServices("owner", "https://example.test/vakha.studia/");
    expect(items.map((item) => item.source_id)).toEqual([...INTERVIEW_CATALOG_SERVICE_IDS]);
    expect(items.map((item) => item.gender)).toEqual(["boys", "girls"]);
    expect(items.every((item) => item.category === INTERVIEW_CATALOG_CATEGORY && item.price === 800)).toBe(true);
    expect(items[0].preview_video_url).toMatch(/schoolboy-interview-15s\.mp4$/);
    expect(items[1].preview_video_url).toBe("");
    expect(items.every((item) => item.preview_url.includes("catalog-interviews/"))).toBe(true);
  });
});
