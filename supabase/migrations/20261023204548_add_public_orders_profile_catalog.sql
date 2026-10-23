alter table public.profiles
  add column if not exists company_name text not null default 'Vakha Studio',
  add column if not exists manager_name text not null default '',
  add column if not exists whatsapp_phone text not null default '',
  add column if not exists whatsapp_template text not null default 'Здравствуйте! Направляю заявку на фотосъёмку для {child}.\nКласс: {class}\nУслуги: {services}\nИтого: {total}\nНомер заявки: {order_number}\nСсылка на заявку: {order_link}',
  add column if not exists watermark_text text not null default 'Vakha Studio',
  add column if not exists watermark_image text not null default '',
  add column if not exists watermark_opacity numeric(3,2) not null default 0.35 check (watermark_opacity between 0.05 and 1),
  add column if not exists public_catalog_token text;

update public.profiles
set public_catalog_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where public_catalog_token is null or char_length(trim(public_catalog_token)) < 32;

alter table public.profiles
  alter column public_catalog_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  alter column public_catalog_token set not null;

create unique index if not exists profiles_public_catalog_token_unique
  on public.profiles (public_catalog_token);

alter table public.parent_orders
  add column if not exists public_token text;

update public.parent_orders
set public_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where public_token is null or char_length(trim(public_token)) < 32;

alter table public.parent_orders
  alter column public_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  alter column public_token set not null;

create unique index if not exists parent_orders_public_token_unique
  on public.parent_orders (public_token);

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
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_class from public.classes
  where public_token = p_token and status = 'active'
    and (public_expires_at is null or public_expires_at > now());
  if not found then return null; end if;
  select * into v_school from public.schools where id = v_class.school_id and status = 'active';
  if not found then return null; end if;
  return jsonb_build_object(
    'school', jsonb_build_object('name', v_school.name, 'city', v_school.city),
    'whatsapp', coalesce((select jsonb_build_object('phone', p.whatsapp_phone, 'company', p.company_name, 'manager', p.manager_name, 'template', p.whatsapp_template) from public.profiles p where p.id = v_class.owner_id), '{}'::jsonb),
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name, 'academic_year', v_class.academic_year, 'photo_session_name', v_class.photo_session_name),
    'children', coalesce((select jsonb_agg(jsonb_build_object('id', ch.id, 'public_name', ch.public_name) order by ch.public_name) from public.children ch where ch.class_id = v_class.id and ch.status = 'active'), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ci.id, 'name', ci.name, 'description', ci.description, 'short_description', ci.short_description,
      'type', ci.type, 'category', ci.category, 'gender', ci.gender, 'price', ci.price,
      'preview_url', ci.preview_url, 'preview_video_url', ci.preview_video_url, 'parent_preview_mode', ci.parent_preview_mode
    ) order by ci.sort_order, ci.name) from public.catalog_items ci where ci.owner_id = v_class.owner_id and ci.is_active = true), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_parent_order(
  p_token text, p_child_id uuid, p_item_ids uuid[], p_request_key uuid, p_parent_note text default ''
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
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;
  select * into v_class from public.classes where public_token = p_token and status = 'active' and (public_expires_at is null or public_expires_at > now()) for share;
  if not found then raise exception 'Ссылка недействительна или просрочена'; end if;
  select * into v_child from public.children where id = p_child_id and class_id = v_class.id and status = 'active';
  if not found then raise exception 'Ребёнок не найден в этом классе'; end if;
  select * into v_existing from public.parent_orders where child_id = v_child.id and status <> 'cancelled' order by created_at desc limit 1;
  if found then
    return jsonb_build_object('duplicate', true, 'order_number', v_existing.order_number, 'public_token', v_existing.public_token, 'status', v_existing.status, 'selected_items', v_existing.selected_items, 'total_amount', v_existing.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name);
  end if;
  select count(distinct item_id) into v_requested_count from unnest(coalesce(p_item_ids, '{}'::uuid[])) as item_id;
  if v_requested_count = 0 then raise exception 'Выберите хотя бы одну услугу'; end if;
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', ci.id, 'name', ci.name, 'price', ci.price, 'type', ci.type,
    'preview_url', ci.preview_url, 'preview_video_url', ci.preview_video_url, 'category', ci.category
  ) order by ci.sort_order, ci.name), '[]'::jsonb), coalesce(sum(ci.price), 0)
  into v_found_count, v_items, v_total
  from public.catalog_items ci where ci.id = any(p_item_ids) and ci.owner_id = v_class.owner_id and ci.is_active = true;
  if v_found_count <> v_requested_count then raise exception 'Одна или несколько услуг недоступны'; end if;
  insert into public.parent_orders (owner_id, class_id, child_id, order_number, selected_items, total_amount, parent_note, request_key)
  values (v_class.owner_id, v_class.id, v_child.id, '', v_items, v_total, left(coalesce(p_parent_note, ''), 1000), p_request_key)
  returning * into v_order;
  return jsonb_build_object('duplicate', false, 'order_number', v_order.order_number, 'public_token', v_order.public_token, 'status', v_order.status, 'selected_items', v_order.selected_items, 'total_amount', v_order.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name);
exception when unique_violation then
  select * into v_existing from public.parent_orders where request_key = p_request_key or (child_id = p_child_id and status <> 'cancelled') order by created_at desc limit 1;
  if found then return jsonb_build_object('duplicate', true, 'order_number', v_existing.order_number, 'public_token', v_existing.public_token, 'status', v_existing.status, 'selected_items', v_existing.selected_items, 'total_amount', v_existing.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name); end if;
  raise;
end;
$$;

create or replace function public.get_public_catalog(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare v_profile public.profiles%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_profile from public.profiles where public_catalog_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'company_name', v_profile.company_name,
    'watermark', jsonb_build_object('text', v_profile.watermark_text, 'image', v_profile.watermark_image, 'opacity', v_profile.watermark_opacity),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ci.id, 'name', ci.name, 'description', ci.description, 'short_description', ci.short_description,
      'type', ci.type, 'category', ci.category, 'gender', ci.gender, 'price', ci.price,
      'preview_url', ci.preview_url, 'preview_video_url', ci.preview_video_url, 'parent_preview_mode', ci.parent_preview_mode
    ) order by ci.sort_order, ci.name) from public.catalog_items ci where ci.owner_id = v_profile.id and ci.is_active = true), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare v_order public.parent_orders%rowtype; v_class public.classes%rowtype; v_school public.schools%rowtype; v_child public.children%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_order from public.parent_orders where public_token = p_token;
  if not found then return null; end if;
  select * into v_class from public.classes where id = v_order.class_id;
  select * into v_school from public.schools where id = v_class.school_id;
  select * into v_child from public.children where id = v_order.child_id;
  return jsonb_build_object('order_number', v_order.order_number, 'status', v_order.status, 'selected_items', v_order.selected_items, 'total_amount', v_order.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name, 'school_name', v_school.name, 'created_at', v_order.created_at);
end;
$$;

revoke all on function public.get_public_class(text) from public, anon, authenticated;
revoke all on function public.submit_parent_order(text, uuid, uuid[], uuid, text) from public, anon, authenticated;
revoke all on function public.get_public_catalog(text) from public, anon, authenticated;
revoke all on function public.get_public_order(text) from public, anon, authenticated;
grant execute on function public.get_public_class(text) to anon, authenticated;
grant execute on function public.submit_parent_order(text, uuid, uuid[], uuid, text) to anon, authenticated;
grant execute on function public.get_public_catalog(text) to anon, authenticated;
grant execute on function public.get_public_order(text) to anon, authenticated;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
