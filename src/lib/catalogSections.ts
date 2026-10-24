export type CatalogGender = "all" | "boys" | "girls";

export type CatalogSection<T> = {
  id: string;
  title: string;
  items: T[];
  notice?: string;
  relatedTitle?: string;
  relatedItems?: T[];
};

type CatalogLike = {
  category: string;
  gender: string;
  name: string;
  type: string;
};

function searchable(item: CatalogLike) {
  return `${item.name} ${item.category} ${item.type}`.toLocaleLowerCase("ru-RU");
}

function isInterview(item: CatalogLike) {
  return item.type === "interview" || searchable(item).includes("интервью");
}

function isVideo(item: CatalogLike) {
  return item.type === "video" || /(?:ai|ии)[-\s]?видео|видео/.test(searchable(item));
}

function matchesGender(item: CatalogLike, gender: CatalogGender) {
  return gender === "all" || !item.gender || item.gender === "unisex" || item.gender === gender;
}

function visualSections<T extends CatalogLike>(items: T[], gender: CatalogGender): CatalogSection<T>[] {
  if (gender === "boys") return items.length ? [{ id: "visual-boys", title: "Образы для мальчиков", items }] : [];
  if (gender === "girls") return items.length ? [{ id: "visual-girls", title: "Образы для девочек", items }] : [];

  const boys = items.filter((item) => item.gender === "boys");
  const girls = items.filter((item) => item.gender === "girls");
  const other = items.filter((item) => item.gender !== "boys" && item.gender !== "girls");
  return [
    boys.length && { id: "visual-boys", title: "Образы для мальчиков", items: boys },
    girls.length && { id: "visual-girls", title: "Образы для девочек", items: girls },
    other.length && { id: "visual-other", title: "Другие образы", items: other },
  ].filter(Boolean) as CatalogSection<T>[];
}

/**
 * Builds the parent-facing hierarchy. Gender is the main choice; videos and
 * interviews stay discoverable even when a separate gender-specific item is absent.
 */
export function buildCatalogSections<T extends CatalogLike>(catalog: T[], gender: CatalogGender): CatalogSection<T>[] {
  const scoped = catalog.filter((item) => matchesGender(item, gender));
  const interviews = scoped.filter(isInterview);
  const videos = scoped.filter((item) => !isInterview(item) && isVideo(item));
  const visuals = scoped.filter((item) => !isInterview(item) && !isVideo(item));
  const sections: CatalogSection<T>[] = [];

  if (interviews.length) sections.push({ id: "interview", title: "Интервью ребёнка", items: interviews });

  if (videos.length) {
    sections.push({ id: "video", title: "AI-видео", items: videos });
  } else {
    const oppositeGender = gender === "boys" ? "girls" : "boys";
    const relatedItems = gender === "all" ? [] : catalog.filter((item) => item.gender === oppositeGender && !isInterview(item) && isVideo(item));
    sections.push({
      id: "video",
      title: "AI-видео",
      items: [],
      notice: gender === "all" ? "Выберите любой образ ниже — его можно оживить в AI-видео." : `Для ${gender === "boys" ? "мальчиков" : "девочек"} отдельного AI-видео пока нет. Любой выбранный образ ниже можно оживить в AI-видео.`,
      relatedTitle: relatedItems.length ? `Доступно для ${oppositeGender === "boys" ? "мальчиков" : "девочек"}` : undefined,
      relatedItems,
    });
  }

  return [...sections, ...visualSections(visuals, gender)];
}
