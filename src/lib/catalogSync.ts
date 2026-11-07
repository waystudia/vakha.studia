export function activeCatalogItemIdsOutsideCrm(
  existing: Array<{ id: string; source_id: string; is_active: boolean }>,
  imported: Array<{ sourceId: string }>,
) {
  const importedSourceIds = new Set(imported.map((item) => item.sourceId));
  return existing
    .filter((item) => item.is_active && !importedSourceIds.has(item.source_id))
    .map((item) => item.id);
}
