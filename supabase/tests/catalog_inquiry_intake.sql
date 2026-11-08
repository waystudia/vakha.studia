begin;

do $$
declare
  v_user uuid := '20000000-0000-4000-8000-000000000001';
  v_school uuid := '20000000-0000-4000-8000-000000000002';
  v_class uuid := '20000000-0000-4000-8000-000000000003';
  v_item uuid := '20000000-0000-4000-8000-000000000004';
  v_token text;
  v_matches jsonb;
  v_existing jsonb;
  v_repeat jsonb;
  v_new jsonb;
begin
  insert into auth.users(id, email) values(v_user, 'catalog-intake-test@example.invalid');
  select public_catalog_token into v_token from public.profiles where id = v_user;

  insert into public.schools(id, owner_id, name, city)
  values(v_school, v_user, 'Детский сад №24', 'Грозный');
  insert into public.classes(id, owner_id, school_id, name, academic_year)
  values(v_class, v_user, v_school, 'Младшая группа', '2026/2027');
  insert into public.catalog_items(id, owner_id, source_id, name, price)
  values(v_item, v_user, 'intake-photo', 'Щенячий патруль', 350);

  v_matches := public.search_catalog_institutions(v_token, 'садик 24');
  if jsonb_array_length(v_matches) <> 1
    or v_matches->0->>'id' <> v_school::text
    or v_matches->0->'classes'->0->>'id' <> v_class::text then
    raise exception 'existing institution lookup failed: %', v_matches;
  end if;

  v_existing := public.submit_catalog_intake(
    v_token,
    '20000000-0000-4000-8000-000000000005',
    v_school,
    '',
    '',
    v_class,
    '',
    'Амина',
    'Иванова',
    '+7 999 111-22-33',
    array[v_item],
    ''
  );
  v_repeat := public.submit_catalog_intake(
    v_token,
    '20000000-0000-4000-8000-000000000005',
    v_school,
    '',
    '',
    v_class,
    '',
    'Амина',
    'Иванова',
    '+7 999 111-22-33',
    array[v_item],
    ''
  );

  if v_existing->>'child_id' <> v_repeat->>'child_id'
    or (select count(*) from public.children where owner_id = v_user) <> 1
    or (select count(*) from public.parent_orders where owner_id = v_user) <> 1 then
    raise exception 'idempotent intake failed';
  end if;

  v_new := public.submit_catalog_intake(
    v_token,
    '20000000-0000-4000-8000-000000000006',
    null,
    'Школа №7',
    'Аргун',
    null,
    '3А',
    'Мухаммад',
    'Тасуханов',
    '+7 963 583-90-94',
    array[v_item],
    'Новая школа'
  );

  if not exists(select 1 from public.schools where id = (v_new->>'school_id')::uuid and name = 'Школа №7' and city = 'Аргун')
    or not exists(select 1 from public.classes where id = (v_new->>'class_id')::uuid and name = '3А')
    or not exists(select 1 from public.children where id = (v_new->>'child_id')::uuid and first_name = 'Мухаммад')
    or not exists(select 1 from public.parent_orders where id = (v_new->>'order_id')::uuid and total_amount = 350)
    or not exists(select 1 from public.catalog_inquiries where id = (v_new->>'inquiry_id')::uuid and group_name = '3А') then
    raise exception 'new project intake failed: %', v_new;
  end if;
end $$;

rollback;
