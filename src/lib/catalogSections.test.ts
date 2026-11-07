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
      "Интервью ребёнка", "AI-видео", "Образы для детей",
    ]);
    expect(buildCatalogSections(catalog, "all").find((section) => section.id === "visual-all")?.items.map((item) => item.name)).toEqual([
      "Капитан пиратов", "Принцесса",
    ]);
  });

  it("puts the selected gender first and keeps the other gender available afterwards", () => {
    expect(buildCatalogSections(catalog, "girls").filter((section) => section.id.startsWith("visual-")).map((section) => section.title)).toEqual([
      "Образы для девочек", "Образы для мальчиков",
    ]);
    expect(buildCatalogSections(catalog, "boys").filter((section) => section.id.startsWith("visual-")).map((section) => section.title)).toEqual([
      "Образы для мальчиков", "Образы для девочек",
    ]);
  });
});
