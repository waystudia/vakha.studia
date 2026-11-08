insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'parent-request-references',
  'parent-request-references',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists parent_request_reference_owner_read on storage.objects;
create policy parent_request_reference_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'parent-request-references'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop function if exists public.submit_parent_custom_request(text, uuid, text, uuid);

create function public.submit_parent_custom_request(
  p_token text,
  p_child_id uuid,
  p_message text,
  p_request_key uuid,
  p_catalog_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_child public.children%rowtype;
  v_catalog_item public.catalog_items%rowtype;
  v_existing public.parent_orders%rowtype;
  v_order public.parent_orders%rowtype;
  v_message text := left(trim(coalesce(p_message, '')), 1000);
  v_custom_item jsonb;
  v_items jsonb;
  v_updated boolean := false;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;
  if char_length(v_message) < 3 and p_catalog_item_id is null then
    raise exception 'Опишите, какой образ или услугу вы хотите';
  end if;

  select * into v_class from public.classes
  where public_token = p_token and status = 'active'
    and (public_expires_at is null or public_expires_at > now())
  for share;
  if not found then raise exception 'Ссылка недействительна или просрочена'; end if;

  select * into v_child from public.children
  where id = p_child_id and class_id = v_class.id and status = 'active';
  if not found then raise exception 'Ребёнок не найден в этом классе'; end if;

  if p_catalog_item_id is not null then
    select * into v_catalog_item from public.catalog_items
    where id = p_catalog_item_id and owner_id = v_class.owner_id and is_active = true;
    if not found then raise exception 'Услуга из каталога больше недоступна'; end if;
  end if;

  v_custom_item := jsonb_strip_nulls(jsonb_build_object(
    'id', 'custom-request',
    'name', 'Индивидуальный запрос',
    'price', 0,
    'type', 'custom',
    'comment', nullif(v_message, ''),
    'reference_service_id', v_catalog_item.id,
    'reference_service_name', nullif(v_catalog_item.name, ''),
    'preview_url', nullif(v_catalog_item.preview_url, '')
  ));

  select * into v_existing from public.parent_orders
  where child_id = v_child.id and status <> 'cancelled'
  order by created_at desc limit 1
  for update;

  if found then
    v_updated := true;
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_items
      from jsonb_array_elements(v_existing.selected_items) item
      where item->>'id' <> 'custom-request';
    v_items := v_items || jsonb_build_array(v_custom_item);

    update public.parent_orders set
      selected_items = v_items,
      parent_note = v_message
    where id = v_existing.id
    returning * into v_order;
  else
    insert into public.parent_orders (
      owner_id, class_id, child_id, order_number,
      selected_items, total_amount, parent_note, request_key
    ) values (
      v_class.owner_id, v_class.id, v_child.id, '',
      jsonb_build_array(v_custom_item), 0, v_message, p_request_key
    ) returning * into v_order;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'updated', v_updated,
    'order_number', v_order.order_number,
    'public_token', v_order.public_token,
    'status', v_order.status,
    'selected_items', v_order.selected_items,
    'total_amount', v_order.total_amount,
    'child_name', v_child.public_name,
    'class_name', v_class.name
  );
exception when unique_violation then
  select * into v_order from public.parent_orders
  where request_key = p_request_key
  order by created_at desc limit 1;
  if found then return jsonb_build_object(
    'duplicate', true,
    'updated', false,
    'order_number', v_order.order_number,
    'public_token', v_order.public_token,
    'status', v_order.status,
    'selected_items', v_order.selected_items,
    'total_amount', v_order.total_amount,
    'child_name', v_child.public_name,
    'class_name', v_class.name
  ); end if;
  raise;
end;
$$;

revoke all on function public.submit_parent_custom_request(text, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_parent_custom_request(text, uuid, text, uuid, uuid) to anon, authenticated;
