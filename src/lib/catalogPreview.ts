type PreviewableCatalogItem = { name: string; preview_url?: string };

const fallbackPreviewByName: Record<string, string> = {
  "Ариэль": "child-girl-coral-sea-princess.webp",
  "Волшебный мир единорогов": "child-girl-unicorn-world.webp",
  "Гоночный чемпион": "child-boy-racing-champion.webp",
  "Исследователь космоса": "child-boy-space-explorer.webp",
  "Парадный кадет": "child-boy-military-cadet.webp",
  "Спасатель спецотряда": "child-boy-rescue-special-unit.webp",
  "Супергерой будущего": "child-boy-original-superhero.webp",
  "Чемпион ММА": "child-boy-mma-champion.webp",
};

export function catalogPreviewUrl(item: PreviewableCatalogItem) {
  const fallback = fallbackPreviewByName[item.name];
  return item.preview_url || (fallback ? `${import.meta.env.BASE_URL}catalog-fallbacks/${fallback}` : "");
}
