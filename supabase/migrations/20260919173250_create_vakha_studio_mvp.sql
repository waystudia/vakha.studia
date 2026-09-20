create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  city text not null check (char_length(trim(city)) between 2 and 120),
  address text not null default '',
  contact_name text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  academic_year text not null check (char_length(trim(academic_year)) between 4 and 20),
  teacher_name text not null default '',
  photo_session_name text not null default 'Школьная фотосессия',
  public_token text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ) unique,
  public_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name, academic_year)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  public_name text not null check (char_length(trim(public_name)) between 2 and 120),
  dedupe_key text generated always as (lower(trim(first_name)) || '|' || lower(trim(last_name))) stored,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index children_active_name_unique
  on public.children (class_id, dedupe_key)
  where status = 'active';

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id text not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  short_description text not null default '',
  type text not null default 'photo',
  category text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  preview_url text not null default '',
  preview_video_url text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_id)
);

create table public.parent_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  order_number text not null unique,
  selected_items jsonb not null check (jsonb_typeof(selected_items) = 'array'),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status text not null default 'new' check (status in ('new', 'confirmed', 'in_progress', 'ready', 'cancelled')),
  parent_note text not null default '',
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index parent_orders_one_active_per_child
  on public.parent_orders (child_id)
  where status <> 'cancelled';

create index classes_school_id_idx on public.classes(school_id);
create index children_class_id_idx on public.children(class_id);
create index parent_orders_class_id_idx on public.parent_orders(class_id);
create index parent_orders_created_at_idx on public.parent_orders(created_at desc);

create or replace function public.prepare_parent_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'VS-' || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create trigger prepare_parent_order_before_insert
before insert on public.parent_orders
for each row execute function public.prepare_parent_order();

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger schools_updated_at before update on public.schools
for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
for each row execute function public.set_updated_at();
create trigger children_updated_at before update on public.children
for each row execute function public.set_updated_at();
create trigger catalog_items_updated_at before update on public.catalog_items
for each row execute function public.set_updated_at();
create trigger parent_orders_updated_at before update on public.parent_orders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.children enable row level security;
alter table public.catalog_items enable row level security;
alter table public.parent_orders enable row level security;

create policy profiles_owner_all on public.profiles
for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy schools_owner_all on public.schools
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy classes_owner_all on public.classes
for all to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.schools s
    where s.id = school_id and s.owner_id = (select auth.uid())
  )
);

create policy children_owner_all on public.children
for all to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.classes c
    where c.id = class_id and c.owner_id = (select auth.uid())
  )
);

create policy catalog_items_owner_all on public.catalog_items
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy parent_orders_owner_all on public.parent_orders
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create or replace function public.get_public_class(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_school public.schools%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then
    return null;
  end if;

  select * into v_class
  from public.classes
  where public_token = p_token
    and status = 'active'
    and (public_expires_at is null or public_expires_at > now());

  if not found then
    return null;
  end if;

  select * into v_school
  from public.schools
  where id = v_class.school_id and status = 'active';

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'school', jsonb_build_object('name', v_school.name, 'city', v_school.city),
    'class', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'academic_year', v_class.academic_year,
      'photo_session_name', v_class.photo_session_name
    ),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object('id', ch.id, 'public_name', ch.public_name) order by ch.public_name)
      from public.children ch
      where ch.class_id = v_class.id and ch.status = 'active'
    ), '[]'::jsonb),
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'name', ci.name,
        'description', ci.description,
        'short_description', ci.short_description,
        'type', ci.type,
        'category', ci.category,
        'price', ci.price,
        'preview_url', ci.preview_url,
        'preview_video_url', ci.preview_video_url
      ) order by ci.sort_order, ci.name)
      from public.catalog_items ci
      where ci.owner_id = v_class.owner_id and ci.is_active = true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_parent_order(
  p_token text,
  p_child_id uuid,
  p_item_ids uuid[],
  p_request_key uuid,
  p_parent_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_child public.children%rowtype;
  v_existing public.parent_orders%rowtype;
  v_order public.parent_orders%rowtype;
  v_items jsonb;
  v_total numeric(12,2);
  v_requested_count integer;
  v_found_count integer;
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'Ссылка недействительна';
  end if;

  select * into v_class
  from public.classes
  where public_token = p_token
    and status = 'active'
    and (public_expires_at is null or public_expires_at > now())
  for share;

  if not found then
    raise exception 'Ссылка недействительна или просрочена';
  end if;

  select * into v_child
  from public.children
  where id = p_child_id and class_id = v_class.id and status = 'active';

  if not found then
    raise exception 'Ребёнок не найден в этом классе';
  end if;

  select * into v_existing
  from public.parent_orders
  where child_id = v_child.id and status <> 'cancelled'
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'order_number', v_existing.order_number,
      'status', v_existing.status,
      'selected_items', v_existing.selected_items,
      'total_amount', v_existing.total_amount,
      'child_name', v_child.public_name,
      'class_name', v_class.name
    );
  end if;

  select count(distinct item_id) into v_requested_count
  from unnest(coalesce(p_item_ids, '{}'::uuid[])) as item_id;

  if v_requested_count = 0 then
    raise exception 'Выберите хотя бы одну услугу';
  end if;

  select
    count(*),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', ci.id,
      'name', ci.name,
      'price', ci.price,
      'type', ci.type
    ) order by ci.sort_order, ci.name), '[]'::jsonb),
    coalesce(sum(ci.price), 0)
  into v_found_count, v_items, v_total
  from public.catalog_items ci
  where ci.id = any(p_item_ids)
    and ci.owner_id = v_class.owner_id
    and ci.is_active = true;

  if v_found_count <> v_requested_count then
    raise exception 'Одна или несколько услуг недоступны';
  end if;

  insert into public.parent_orders (
    owner_id, class_id, child_id, order_number,
    selected_items, total_amount, parent_note, request_key
  ) values (
    v_class.owner_id, v_class.id, v_child.id, '',
    v_items, v_total, left(coalesce(p_parent_note, ''), 1000), p_request_key
  )
  returning * into v_order;

  return jsonb_build_object(
    'duplicate', false,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'selected_items', v_order.selected_items,
    'total_amount', v_order.total_amount,
    'child_name', v_child.public_name,
    'class_name', v_class.name
  );
exception
  when unique_violation then
    select * into v_existing
    from public.parent_orders
    where request_key = p_request_key or (child_id = p_child_id and status <> 'cancelled')
    order by created_at desc
    limit 1;
    if found then
      return jsonb_build_object(
        'duplicate', true,
        'order_number', v_existing.order_number,
        'status', v_existing.status,
        'selected_items', v_existing.selected_items,
        'total_amount', v_existing.total_amount,
        'child_name', v_child.public_name,
        'class_name', v_class.name
      );
    end if;
    raise;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.get_public_class(text) from public, anon, authenticated;
revoke all on function public.submit_parent_order(text, uuid, uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.get_public_class(text) to anon, authenticated;
grant execute on function public.submit_parent_order(text, uuid, uuid[], uuid, text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, insert, update, delete on public.catalog_items to authenticated;
grant select, insert, update, delete on public.parent_orders to authenticated;

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
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'catalog-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy catalog_previews_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'catalog-previews'
  and owner_id = (select auth.uid()::text)
);
