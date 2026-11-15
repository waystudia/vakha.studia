# Legacy public catalog restored — 2026-11-15

User explicitly approved publishing the common catalog to zakaz.khanzama.ru.
Only Vakha static frontend/public catalog data changed; no CRM database writes,
DNS changes, children/teacher/order imports, or changes to the old Supabase site.

Source: live legacy catalog_items, read-only Supabase query. 89 records backed up,
79 active public services. All 167 source media downloaded and SHA-256 checked;
161 files used by active services. Public snapshot is independent of Supabase.

Server backup: `/var/backups/vakha-catalog-20261115/` and matching `.zip`.
Full backup SHA256: b8cceda8213ee28717cf00d5bd34b41475cc7699a175df0304c828d46122aeee.
Mac active-services ZIP:
`/Users/abdulkadyrov2002/Downloads/Vakha-catalog-79-services-20261115.zip`.
ZIP CRC passed; 79 services, 161 assets. Public ZIP has only public active data.

Root `/` and `/catalog` now display a read-only catalog. Existing `/p/:token`
remains the order entry point. Existing service cards/viewer are reused.
New snapshot JSON and assets: `/catalog-snapshot/`. No roster or staff data.
This is a static snapshot, not automatic canonical CRM synchronization; future
catalog updates require regenerating it. IDs/prices retained from the source.

Build: VITE_CRM_MODE=true, empty Supabase env. 115 tests passed; default build
also passed. Code was packaged as index.html+assets over the existing release,
public media retained; new directory prepared and current symlink switched.
Pre-change release `/srv/vakha-studia/releases/20261113-v1` is retained.
Public HTTPS JSON returned 79 entries; browser phone-width check showed cards,
prices and downloaded photos. Real orders were not submitted.

Rebuild snapshot from full backup:
`node scripts/prepare-legacy-catalog-snapshot.mjs backup.zip dist/catalog-snapshot`.
The generated snapshot/media and backup are intentionally not committed to Git.
