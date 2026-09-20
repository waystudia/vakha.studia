begin;

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-000000000001';
  v_school uuid := '00000000-0000-4000-8000-000000000002';
  v_class uuid := '00000000-0000-4000-8000-000000000003';
  v_child uuid := '00000000-0000-4000-8000-000000000004';
  v_item_a uuid := '00000000-0000-4000-8000-000000000005';
  v_item_b uuid := '00000000-0000-4000-8000-000000000006';
  v_token text := 'mvp-integration-token-0123456789-abcdefghijklmnopqrstuvwxyz';
  v_payload jsonb;
  v_first jsonb;
  v_second jsonb;
begin
  insert into auth.users(id) values (v_user);
  insert into public.schools(id, owner_id, name, city)
  values (v_school, v_user, 'Тестовая школа', 'Москва');
  insert into public.classes(id, owner_id, school_id, name, academic_year, public_token)
  values (v_class, v_user, v_school, '3А', '2026/2027', v_token);
  insert into public.children(id, owner_id, class_id, first_name, last_name, public_name)
  values (v_child, v_user, v_class, 'Адам', 'Абдуллаев', 'Адам А.');
  insert into public.catalog_items(id, owner_id, source_id, name, price) values
    (v_item_a, v_user, 'photo', 'Обычные фото', 400),
    (v_item_b, v_user, 'video', 'AI-видео', 300);

  v_payload := public.get_public_class(v_token);
  if jsonb_array_length(v_payload->'children') <> 1
    or jsonb_array_length(v_payload->'catalog') <> 2 then
    raise exception 'public payload assertion failed';
  end if;

  v_first := public.submit_parent_order(
    v_token, v_child, array[v_item_a, v_item_b],
    '00000000-0000-4000-8000-000000000007', ''
  );
  v_second := public.submit_parent_order(
    v_token, v_child, array[v_item_a],
    '00000000-0000-4000-8000-000000000008', ''
  );

  if (v_first->>'duplicate')::boolean
    or not (v_second->>'duplicate')::boolean then
    raise exception 'duplicate protection assertion failed';
  end if;
  if (v_first->>'total_amount')::numeric <> 700 then
    raise exception 'server total assertion failed';
  end if;

  raise notice 'MVP integration passed: public payload, total 700, duplicate blocked';
end $$;

rollback;
