export function activeCatalogItemIdsOutsideCrm(
  existing: Array<{ id: string; source_id: string; is_active: boolean; source?: string }>,
  imported: Array<{ sourceId: string }>,
) {
  const importedSourceIds = new Set(imported.map((item) => item.sourceId));
  return existing
    .filter((item) => item.is_active && !String(item.source || "").startsWith("system_") && !importedSourceIds.has(item.source_id))
    .map((item) => item.id);
}
