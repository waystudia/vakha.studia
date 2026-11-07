create function public.cancel_parent_order(p_token text, p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_child public.children%rowtype;
  v_order public.parent_orders%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'Ссылка недействительна'; end if;

  select * into v_class from public.classes
  where public_token = p_token and status = 'active'
    and (public_expires_at is null or public_expires_at > now())
  for share;
  if not found then raise exception 'Ссылка недействительна или просрочена'; end if;

  select * into v_child from public.children
  where id = p_child_id and class_id = v_class.id and status = 'active';
  if not found then raise exception 'Ребёнок не найден в этом классе'; end if;

  select * into v_order from public.parent_orders
  where child_id = v_child.id and class_id = v_class.id and status <> 'cancelled'
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Активная заявка не найдена'; end if;
  if v_order.status not in ('new', 'confirmed') then
    raise exception 'Заявка уже в работе. Для отмены свяжитесь со студией';
  end if;

  update public.parent_orders set status = 'cancelled'
  where id = v_order.id returning * into v_order;

  return jsonb_build_object(
    'duplicate', false, 'updated', true,
    'order_number', v_order.order_number, 'public_token', v_order.public_token,
    'status', v_order.status, 'selected_items', '[]'::jsonb,
    'total_amount', 0, 'child_name', v_child.public_name, 'class_name', v_class.name
  );
end;
$$;

revoke all on function public.cancel_parent_order(text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_parent_order(text, uuid) to anon, authenticated;
