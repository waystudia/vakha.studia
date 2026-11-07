import { describe, expect, it } from "vitest";
import { buildCatalogSections } from "./catalogSections";

const entry = (name: string, gender = "unisex", type = "photo") => ({ name, category: "Фото", type, gender });
const catalog = [
  entry("Интервью ребёнка", "unisex", "interview"),
  entry("Принцесса — ИИ-видео", "girls", "video"),
  entry("Чеченский джигит", "boys"),
  entry("Девочка у башни", "girls"),
  entry("Супермен", "boys"),
  entry("Чудо-женщина", "girls"),
  entry("Майнкрафт", "boys"),
  entry("Пикачу", "girls"),
  entry("Горный спасатель", "boys"),
  entry("Пилот спасательной службы", "girls"),
  entry("Общее фото класса"),
  entry("Капитан пиратов", "boys"),
  entry("Сказочная принцесса", "girls"),
];

describe("buildCatalogSections", () => {
  it("places every CRM service in one meaningful category", () => {
    const sections = buildCatalogSections(catalog, "all");
    expect(sections.map((section) => section.title)).toEqual([
      "Интервью", "ИИ-видео", "Вайнахские образы", "Бойцовские и герои",
      "Игровые миры", "Профессии и спорт", "Общее фото", "Сказочные образы",
    ]);
    expect(sections.flatMap((section) => section.items)).toHaveLength(catalog.length);
    expect(sections.find((section) => section.id === "professions")?.items.map((item) => item.name)).toEqual([
      "Горный спасатель", "Пилот спасательной службы",
    ]);
  });

  it("alternates boys and girls so the first pair forms left and right columns", () => {
    expect(buildCatalogSections(catalog, "all").find((section) => section.id === "fighters")?.items.map((item) => item.name)).toEqual([
      "Супермен", "Чудо-женщина",
    ]);
  });

  it("puts the selected gender first inside every category and keeps other choices available", () => {
    expect(buildCatalogSections(catalog, "girls").find((section) => section.id === "vainakh")?.items.map((item) => item.name)).toEqual([
      "Девочка у башни", "Чеченский джигит",
    ]);
    expect(buildCatalogSections(catalog, "boys").find((section) => section.id === "games")?.items.map((item) => item.name)).toEqual([
      "Майнкрафт", "Пикачу",
    ]);
  });

  it("places Roblox, Free Fire and PUBG services in the games category", () => {
    const games = buildCatalogSections([
      entry("Roblox приключение", "boys"),
      entry("Фри Фаер чемпион", "girls"),
      entry("PUBG герой", "boys"),
    ], "all").find((section) => section.id === "games");
    expect(games?.items.map((item) => item.name)).toEqual(["Roblox приключение", "Фри Фаер чемпион", "PUBG герой"]);
  });
});
