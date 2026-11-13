begin;
do $$
declare owner uuid; school uuid; class uuid; token text := repeat('testchild', 8); a jsonb; b jsonb;
begin
  select id into owner from auth.users limit 1;
  if owner is null then raise exception 'Test needs an existing owner'; end if;
  insert into public.schools(owner_id, name, city) values(owner, 'Тест добавления — откат', 'Тест') returning id into school;
  insert into public.classes(owner_id, school_id, name, academic_year, public_token) values(owner, school, 'Тест', '2026', token) returning id into class;
  a := public.add_public_class_child(token, 'Адам', 'Семёнов');
  if not exists(select 1 from public.children where id = (a->'child'->>'id')::uuid and crm_source_id = a->'child'->>'id') then raise exception 'Missing stable CRM identity'; end if;
  b := public.add_public_class_child(token, ' адам ', 'семенов');
  if a->'child'->>'id' <> b->'child'->>'id' or not (b->>'duplicate')::boolean then raise exception 'Normalized duplicate failed'; end if;
  b := public.add_public_class_child(token, 'Семенов', 'Адам');
  if a->'child'->>'id' <> b->'child'->>'id' then raise exception 'Swapped duplicate failed'; end if;
  b := public.add_public_class_child(token, 'Адам', 'Семёноф');
  if (b->>'duplicate')::boolean then raise exception 'Similar name must be allowed'; end if;
  if (select count(*) from public.children where class_id=class) <> 2 then raise exception 'Wrong child count'; end if;
  if exists(select 1 from public.parent_orders where class_id=class) then raise exception 'Must not create an order'; end if;
  begin
    perform public.add_public_class_child('bad-token', 'Иса', 'Гараев');
    raise exception 'Invalid token accepted';
  exception when raise_exception then if sqlerrm = 'Invalid token accepted' then raise; end if; end;
  update public.classes set public_expires_at=now()-interval '1 day' where id=class;
  begin
    perform public.add_public_class_child(token, 'Иса', 'Гараев');
    raise exception 'Expired token accepted';
  exception when raise_exception then if sqlerrm = 'Expired token accepted' then raise; end if; end;
end $$;
rollback;
