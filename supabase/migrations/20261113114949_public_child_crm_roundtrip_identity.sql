-- Keep site → CRM → site identity stable from the first export.
create or replace function public.add_public_class_child(p_token text, p_first_name text, p_last_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_class public.classes%rowtype;
  v_child public.children%rowtype;
  v_first text := trim(regexp_replace(coalesce(p_first_name, ''), '[[:space:]]+', ' ', 'g'));
  v_last text := trim(regexp_replace(coalesce(p_last_name, ''), '[[:space:]]+', ' ', 'g'));
  v_duplicate boolean := false;
  v_new_id uuid := gen_random_uuid();
begin
  if p_token is null or length(p_token) < 32 then raise exception 'Ссылка класса недействительна'; end if;
  if length(v_first) not between 1 and 100 or length(v_last) not between 1 and 100
     or length(v_first || ' ' || v_last) > 120
     or v_first !~ '^[[:alpha:]][[:alpha:][:space:]’''ʼ‐‑–—-]*$'
     or v_last !~ '^[[:alpha:]][[:alpha:][:space:]’''ʼ‐‑–—-]*$'
  then raise exception 'Укажите имя и фамилию буквами (до 100 символов, вместе до 120)'; end if;
  -- Serializes additions within a class, including retries from different devices.
  select c.* into v_class from public.classes c
    join public.schools s on s.id = c.school_id and s.status = 'active'
    where c.public_token = p_token and c.status = 'active'
      and (c.public_expires_at is null or c.public_expires_at > now()) for update of c;
  if not found then raise exception 'Ссылка класса недействительна или срок её действия истёк'; end if;
  select * into v_child from public.children c where c.class_id = v_class.id and c.status = 'active'
    and ((public.normalize_class_child_name(c.first_name) = public.normalize_class_child_name(v_first)
      and public.normalize_class_child_name(c.last_name) = public.normalize_class_child_name(v_last))
    or (public.normalize_class_child_name(c.first_name) = public.normalize_class_child_name(v_last)
      and public.normalize_class_child_name(c.last_name) = public.normalize_class_child_name(v_first)))
    order by c.created_at limit 1;
  if found then v_duplicate := true;
  else
    if (select count(*) from public.children where class_id = v_class.id and status = 'active') >= 200
      then raise exception 'В классе уже 200 детей. Обратитесь в студию'; end if;
    insert into public.children(id, crm_source_id, owner_id, class_id, first_name, last_name, public_name)
      values (v_new_id, v_new_id::text, v_class.owner_id, v_class.id, v_first, v_last, v_last || ' ' || v_first) returning * into v_child;
  end if;
  return jsonb_build_object('duplicate', v_duplicate, 'child', jsonb_build_object(
    'id', v_child.id, 'public_name', v_child.last_name || ' ' || v_child.first_name,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('status', o.status, 'items', o.selected_items))
      from public.parent_orders o where o.child_id = v_child.id and o.class_id = v_class.id and o.status <> 'cancelled'), '[]'::jsonb)));
end;
$$;
revoke all on function public.add_public_class_child(text, text, text) from public, anon, authenticated;
grant execute on function public.add_public_class_child(text, text, text) to anon, authenticated;
