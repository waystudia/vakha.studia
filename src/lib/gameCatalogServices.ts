export const GAME_CATALOG_CATEGORY = "Игровые фотомонтажи";

export const GAME_CATALOG_SERVICE_IDS = [
  "game-photo-free-fire-boy",
  "game-photo-pubg-boy",
  "game-photo-roblox-boy",
  "game-photo-roblox-girl",
] as const;

const definitions = [
  {
    source_id: GAME_CATALOG_SERVICE_IDS[0],
    name: "Free Fire — игровой фотомонтаж",
    gender: "boys",
    preview: "free-fire.webp",
    description: "Кинематографичный турнирный постер: ребёнок и игровой персонаж в яркой футуристической арене с детализированным фантастическим реквизитом.",
  },
  {
    source_id: GAME_CATALOG_SERVICE_IDS[1],
    name: "PUBG — игровой фотомонтаж",
    gender: "boys",
    preview: "pubg.webp",
    description: "Приключенческий островной постер: ребёнок рядом с персонажем в фирменном шлеме, парашютом и игровым реквизитом.",
  },
  {
    source_id: GAME_CATALOG_SERVICE_IDS[2],
    name: "Roblox — мальчик",
    gender: "boys",
    preview: "roblox-boy.webp",
    description: "Яркий фотомонтаж мальчика с классическим блочным аватаром в мире парящих островов и игровых испытаний.",
  },
  {
    source_id: GAME_CATALOG_SERVICE_IDS[3],
    name: "Roblox — девочка",
    gender: "girls",
    preview: "roblox-girl.webp",
    description: "Яркий фотомонтаж девочки с классическим блочным аватаром в красочном игровом мире.",
  },
] as const;

export function gameCatalogServices(ownerId: string, publicBaseUrl: string) {
  const base = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  return definitions.map((item, index) => ({
    owner_id: ownerId,
    source_id: item.source_id,
    name: item.name,
    short_description: "Персональный игровой фотомонтаж с ребёнком и персонажем, вертикальный A4.",
    description: item.description,
    type: "photo",
    category: GAME_CATALOG_CATEGORY,
    gender: item.gender,
    price: 350,
    preview_url: new URL(`catalog-games/${item.preview}`, base).href,
    original_url: new URL(`catalog-games/originals/${item.preview.replace(/\.webp$/, ".png")}`, base).href,
    preview_video_url: "",
    parent_preview_mode: "print",
    is_active: true,
    sort_order: 500 + index,
    source: "system_game_catalog",
  }));
}
