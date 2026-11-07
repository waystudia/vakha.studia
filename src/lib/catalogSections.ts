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

function interleave<T>(left: T[], right: T[]) {
  const result: T[] = [];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index]) result.push(left[index]);
    if (right[index]) result.push(right[index]);
  }
  return result;
}

function visualSections<T extends CatalogLike>(items: T[], gender: CatalogGender): CatalogSection<T>[] {
  const boys = items.filter((item) => item.gender === "boys");
  const girls = items.filter((item) => item.gender === "girls");
  const other = items.filter((item) => item.gender !== "boys" && item.gender !== "girls");
  if (gender === "all") {
    const paired = interleave(boys, girls);
    return [...paired, ...other].length ? [{ id: "visual-all", title: "Образы для детей", items: [...paired, ...other] }] : [];
  }
  const preferred = gender === "girls"
    ? [girls.length && { id: "visual-girls", title: "Образы для девочек", items: girls }, boys.length && { id: "visual-boys", title: "Образы для мальчиков", items: boys }]
    : [boys.length && { id: "visual-boys", title: "Образы для мальчиков", items: boys }, girls.length && { id: "visual-girls", title: "Образы для девочек", items: girls }];
  return [
    ...preferred,
    other.length && { id: "visual-other", title: "Другие образы", items: other },
  ].filter(Boolean) as CatalogSection<T>[];
}

/**
 * Builds the parent-facing hierarchy. Gender is the main choice; videos and
 * interviews stay discoverable even when a separate gender-specific item is absent.
 */
export function buildCatalogSections<T extends CatalogLike>(catalog: T[], gender: CatalogGender): CatalogSection<T>[] {
  const interviews = catalog.filter(isInterview);
  const videos = catalog.filter((item) => !isInterview(item) && isVideo(item));
  const visuals = catalog.filter((item) => !isInterview(item) && !isVideo(item));
  const sections: CatalogSection<T>[] = [];

  if (interviews.length) sections.push({ id: "interview", title: "Интервью ребёнка", items: interviews });

  if (videos.length) sections.push({ id: "video", title: "AI-видео", items: videos });

  return [...sections, ...visualSections(visuals, gender)];
}
