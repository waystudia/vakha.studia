-- Restore the public bucket used by catalog ZIP imports if it was removed manually.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-previews',
  'catalog-previews',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
