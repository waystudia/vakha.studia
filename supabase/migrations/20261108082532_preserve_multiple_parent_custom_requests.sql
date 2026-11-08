create or replace function public.submit_parent_custom_request(
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
  v_duplicate boolean := false;
  v_updated boolean := false;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;
  if char_length(v_message) < 3 and p_catalog_item_id is null then raise exception 'Опишите, какой образ или услугу вы хотите'; end if;

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
    'id', 'custom-request-' || p_request_key::text,
    'request_key', p_request_key::text,
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
    if v_existing.status not in ('new', 'confirmed') then raise exception 'Заявка уже в работе. Для изменений свяжитесь со студией'; end if;
    select exists (
      select 1 from jsonb_array_elements(coalesce(v_existing.selected_items, '[]'::jsonb)) item
      where item->>'request_key' = p_request_key::text
    ) into v_duplicate;
    if v_duplicate then
      v_order := v_existing;
    else
      v_updated := true;
      v_items := coalesce(v_existing.selected_items, '[]'::jsonb) || jsonb_build_array(v_custom_item);
      update public.parent_orders set selected_items = v_items
      where id = v_existing.id returning * into v_order;
    end if;
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
    'duplicate', v_duplicate, 'updated', v_updated,
    'order_number', v_order.order_number, 'public_token', v_order.public_token,
    'status', v_order.status, 'selected_items', v_order.selected_items,
    'total_amount', v_order.total_amount, 'child_name', v_child.public_name,
    'class_name', v_class.name
  );
exception when unique_violation then
  select * into v_order from public.parent_orders where request_key = p_request_key order by created_at desc limit 1;
  if found then return jsonb_build_object(
    'duplicate', true, 'updated', false, 'order_number', v_order.order_number,
    'public_token', v_order.public_token, 'status', v_order.status,
    'selected_items', v_order.selected_items, 'total_amount', v_order.total_amount,
    'child_name', v_child.public_name, 'class_name', v_class.name
  ); end if;
  raise;
end;
$$;

revoke all on function public.submit_parent_custom_request(text, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_parent_custom_request(text, uuid, text, uuid, uuid) to anon, authenticated;

create or replace function public.submit_parent_order_v2(
  p_token text, p_child_id uuid, p_item_ids uuid[], p_without_lamination_ids uuid[],
  p_request_key uuid, p_parent_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype; v_child public.children%rowtype;
  v_existing public.parent_orders%rowtype; v_order public.parent_orders%rowtype;
  v_items jsonb; v_total numeric(12,2); v_requested_count integer;
  v_found_count integer; v_invalid_lamination_count integer; v_custom_items jsonb;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;
  select * into v_class from public.classes where public_token = p_token and status = 'active' and (public_expires_at is null or public_expires_at > now()) for share;
  if not found then raise exception 'Ссылка недействительна или просрочена'; end if;
  select * into v_child from public.children where id = p_child_id and class_id = v_class.id and status = 'active';
  if not found then raise exception 'Ребёнок не найден в этом классе'; end if;
  select * into v_existing from public.parent_orders where child_id = v_child.id and status <> 'cancelled' order by created_at desc limit 1 for update;
  if found and v_existing.status not in ('new', 'confirmed') then raise exception 'Заявка уже в работе. Для изменений свяжитесь со студией'; end if;
  select count(distinct item_id) into v_requested_count from unnest(coalesce(p_item_ids, '{}'::uuid[])) as item_id;
  if v_requested_count = 0 then raise exception 'Выберите хотя бы одну услугу'; end if;
  select count(*) into v_invalid_lamination_count from unnest(coalesce(p_without_lamination_ids, '{}'::uuid[])) as item_id where not (item_id = any(coalesce(p_item_ids, '{}'::uuid[])));
  if v_invalid_lamination_count > 0 then raise exception 'Некорректный выбор ламинации'; end if;
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', ci.id, 'name', ci.name,
      'price', case when ci.id = any(coalesce(p_without_lamination_ids, '{}'::uuid[])) then greatest(ci.price - 50, 0) else ci.price end,
      'type', ci.type, 'preview_url', ci.preview_url, 'preview_video_url', ci.preview_video_url, 'category', ci.category,
      'comment', case when ci.id = any(coalesce(p_without_lamination_ids, '{}'::uuid[])) then 'Без ламинации (защиты)' else 'С ламинацией (защиты)' end
    ) order by ci.sort_order, ci.name), '[]'::jsonb),
    coalesce(sum(case when ci.id = any(coalesce(p_without_lamination_ids, '{}'::uuid[])) then greatest(ci.price - 50, 0) else ci.price end), 0)
  into v_found_count, v_items, v_total
  from public.catalog_items ci where ci.id = any(p_item_ids) and ci.owner_id = v_class.owner_id and ci.is_active = true;
  if v_found_count <> v_requested_count then raise exception 'Одна или несколько услуг недоступны'; end if;

  if v_existing.id is not null then
    select coalesce(jsonb_agg(item), '[]'::jsonb) into v_custom_items
    from jsonb_array_elements(v_existing.selected_items) item
    where item->>'type' = 'custom' or item->>'id' like 'custom-request%';
    v_items := v_items || v_custom_items;
    update public.parent_orders set selected_items = v_items, total_amount = v_total,
      parent_note = case when jsonb_array_length(v_custom_items) > 0 then parent_note else left(coalesce(p_parent_note, ''), 1000) end
    where id = v_existing.id returning * into v_order;
    return jsonb_build_object('duplicate', false, 'updated', true, 'order_number', v_order.order_number, 'public_token', v_order.public_token, 'status', v_order.status, 'selected_items', v_order.selected_items, 'total_amount', v_order.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name);
  end if;

  insert into public.parent_orders (owner_id, class_id, child_id, order_number, selected_items, total_amount, parent_note, request_key)
  values (v_class.owner_id, v_class.id, v_child.id, '', v_items, v_total, left(coalesce(p_parent_note, ''), 1000), p_request_key)
  returning * into v_order;
  return jsonb_build_object('duplicate', false, 'updated', false, 'order_number', v_order.order_number, 'public_token', v_order.public_token, 'status', v_order.status, 'selected_items', v_order.selected_items, 'total_amount', v_order.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name);
exception when unique_violation then
  select * into v_existing from public.parent_orders where request_key = p_request_key or (child_id = p_child_id and status <> 'cancelled') order by created_at desc limit 1;
  if found then return jsonb_build_object('duplicate', true, 'updated', false, 'order_number', v_existing.order_number, 'public_token', v_existing.public_token, 'status', v_existing.status, 'selected_items', v_existing.selected_items, 'total_amount', v_existing.total_amount, 'child_name', v_child.public_name, 'class_name', v_class.name); end if;
  raise;
end;
$$;

revoke all on function public.submit_parent_order_v2(text, uuid, uuid[], uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.submit_parent_order_v2(text, uuid, uuid[], uuid[], uuid, text) to anon, authenticated;
