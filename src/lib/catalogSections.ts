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

type CategoryDefinition = {
  id: string;
  title: string;
  matches: (item: CatalogLike) => boolean;
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

function matches(item: CatalogLike, pattern: RegExp) {
  return pattern.test(searchable(item));
}

const categoryDefinitions: CategoryDefinition[] = [
  { id: "interview", title: "Интервью", matches: isInterview },
  { id: "video", title: "ИИ-видео", matches: (item) => !isInterview(item) && isVideo(item) },
  { id: "vainakh", title: "Вайнахские образы", matches: (item) => matches(item, /чечен|мечет|башн|страж гор|джигит|крепост|горн(?:ого|ый) водопад|водопад в белом|хозяйка гор/) },
  { id: "fighters", title: "Бойцовские и герои", matches: (item) => matches(item, /боец|мма|ufc|рыцар|супермен|халк|тор\b|бэтмен|черепаш|вольтрон|капитан америка|капитан марвел|чудо-женщ|леди баг|железн(?:ый|ого) человек|супергер|воительниц/) },
  { id: "games", title: "Игровые миры", matches: (item) => matches(item, /майнкрафт|тейлз|соник|пикачу|базз лайтер|робот-друг|щенячий патруль/) },
  { id: "professions", title: "Профессии и спорт", matches: (item) => matches(item, /спасател|наблюдател|пилот|кадет|футбольн|наездниц|балерин/) },
  { id: "class-photo", title: "Общее фото", matches: (item) => matches(item, /общее фото|фото класса|класс/) },
  { id: "fairytale", title: "Сказочные образы", matches: () => true },
];

function interleave<T>(left: T[], right: T[]) {
  const result: T[] = [];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index]) result.push(left[index]);
    if (right[index]) result.push(right[index]);
  }
  return result;
}

function orderByGender<T extends CatalogLike>(items: T[], gender: CatalogGender) {
  const boys = items.filter((item) => item.gender === "boys");
  const girls = items.filter((item) => item.gender === "girls");
  const unisex = items.filter((item) => item.gender !== "boys" && item.gender !== "girls");
  if (gender === "all") return [...interleave(boys, girls), ...unisex];
  return gender === "girls" ? [...girls, ...unisex, ...boys] : [...boys, ...unisex, ...girls];
}

/**
 * Builds one parent-facing section per real theme. Every service is assigned
 * once; gender changes ordering inside each theme without hiding choices.
 */
export function buildCatalogSections<T extends CatalogLike>(catalog: T[], gender: CatalogGender): CatalogSection<T>[] {
  const remaining = new Set(catalog);
  return categoryDefinitions.flatMap((definition) => {
    const items = catalog.filter((item) => remaining.has(item) && definition.matches(item));
    items.forEach((item) => remaining.delete(item));
    return items.length ? [{ id: definition.id, title: definition.title, items: orderByGender(items, gender) }] : [];
  });
}
