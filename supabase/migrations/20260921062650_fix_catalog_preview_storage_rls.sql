-- Allow authenticated catalog owners to replace preview files with storage.upload(..., { upsert: true }).
-- The original policy only covered insert, while an upsert also performs SELECT/UPDATE checks.
drop policy if exists catalog_previews_select on storage.objects;
drop policy if exists catalog_previews_insert on storage.objects;
drop policy if exists catalog_previews_update on storage.objects;

create policy catalog_previews_select on storage.objects
for select to anon, authenticated
using (bucket_id = 'catalog-previews');

create policy catalog_previews_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'catalog-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy catalog_previews_update on storage.objects
for update to authenticated
using (
  bucket_id = 'catalog-previews'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'catalog-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
