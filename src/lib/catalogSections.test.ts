import { describe, expect, it } from "vitest";
import { buildCatalogSections } from "./catalogSections";

const catalog = [
  { name: "Интервью ребёнка", category: "Интервью", type: "interview", gender: "unisex" },
  { name: "AI-видео для принцессы", category: "AI-видео", type: "video", gender: "girls" },
  { name: "Капитан пиратов", category: "Образы", type: "ai", gender: "boys" },
  { name: "Принцесса", category: "Образы", type: "ai", gender: "girls" },
];

describe("buildCatalogSections", () => {
  it("keeps the requested order for the whole catalog", () => {
    expect(buildCatalogSections(catalog, "all").map((section) => section.title)).toEqual([
      "Интервью ребёнка", "AI-видео", "Образы для мальчиков", "Образы для девочек",
    ]);
  });

  it("explains how to animate a boy's image when videos only exist for girls", () => {
    const video = buildCatalogSections(catalog, "boys").find((section) => section.id === "video");
    expect(video?.notice).toContain("Любой выбранный образ ниже можно оживить");
    expect(video?.relatedTitle).toBe("Доступно для девочек");
    expect(video?.relatedItems?.map((item) => item.name)).toEqual(["AI-видео для принцессы"]);
  });
});
