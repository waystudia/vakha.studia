alter table public.catalog_items
  add column if not exists original_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-originals',
  'catalog-originals',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists catalog_originals_select on storage.objects;
drop policy if exists catalog_originals_insert on storage.objects;
drop policy if exists catalog_originals_update on storage.objects;
drop policy if exists catalog_originals_delete on storage.objects;

create policy catalog_originals_select on storage.objects
for select to anon, authenticated
using (bucket_id = 'catalog-originals');

create policy catalog_originals_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'catalog-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy catalog_originals_update on storage.objects
for update to authenticated
using (
  bucket_id = 'catalog-originals'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'catalog-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy catalog_originals_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'catalog-originals'
  and owner_id = (select auth.uid())::text
);
