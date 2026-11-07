create or replace function public.submit_parent_custom_request(
  p_token text,
  p_child_id uuid,
  p_message text,
  p_request_key uuid
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
  v_message text := left(trim(coalesce(p_message, '')), 1000);
  v_custom_item jsonb;
  v_items jsonb;
  v_updated boolean := false;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;
  if char_length(v_message) < 3 then raise exception 'Опишите, какой образ или услугу вы хотите'; end if;

  select * into v_class from public.classes
  where public_token = p_token and status = 'active'
    and (public_expires_at is null or public_expires_at > now())
  for share;
  if not found then raise exception 'Ссылка недействительна или просрочена'; end if;

  select * into v_child from public.children
  where id = p_child_id and class_id = v_class.id and status = 'active';
  if not found then raise exception 'Ребёнок не найден в этом классе'; end if;

  v_custom_item := jsonb_build_object(
    'id', 'custom-request',
    'name', 'Индивидуальный запрос',
    'price', 0,
    'type', 'custom',
    'comment', v_message
  );

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

revoke all on function public.submit_parent_custom_request(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.submit_parent_custom_request(text, uuid, text, uuid) to anon, authenticated;
