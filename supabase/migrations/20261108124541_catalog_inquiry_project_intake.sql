alter table public.catalog_inquiries
  add column city text not null default '',
  add column group_name text not null default '',
  add column school_id uuid references public.schools(id) on delete set null,
  add column class_id uuid references public.classes(id) on delete set null,
  add column child_id uuid references public.children(id) on delete set null,
  add column order_id uuid references public.parent_orders(id) on delete set null;

create index catalog_inquiries_school_id_idx on public.catalog_inquiries(school_id);
create index catalog_inquiries_class_id_idx on public.catalog_inquiries(class_id);
create index catalog_inquiries_child_id_idx on public.catalog_inquiries(child_id);

create function public.search_catalog_institutions(p_token text, p_query text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_query text := trim(coalesce(p_query, ''));
  v_normalized text;
  v_result jsonb;
begin
  select id into v_owner
  from public.profiles
  where public_catalog_token = p_token;

  if v_owner is null or char_length(v_query) not between 2 and 120 then
    return '[]'::jsonb;
  end if;

  v_normalized := trim(regexp_replace(lower(v_query), '[^0-9a-zа-яё]+', ' ', 'g'));

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', match.id,
    'name', match.name,
    'city', match.city,
    'classes', match.classes
  ) order by match.rank, match.name, match.city), '[]'::jsonb)
  into v_result
  from (
    select
      s.id,
      s.name,
      s.city,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'academic_year', c.academic_year
        ) order by c.academic_year desc, c.name)
        from public.classes c
        where c.school_id = s.id
          and c.owner_id = v_owner
          and c.status = 'active'
      ), '[]'::jsonb) as classes,
      case
        when trim(regexp_replace(lower(s.name || ' ' || s.city), '[^0-9a-zа-яё]+', ' ', 'g')) = v_normalized then 0
        when trim(regexp_replace(lower(s.name || ' ' || s.city), '[^0-9a-zа-яё]+', ' ', 'g')) like v_normalized || '%' then 1
        else 2
      end as rank
    from public.schools s
    where s.owner_id = v_owner
      and s.status = 'active'
      and (
        (
          exists (
            select 1
            from regexp_split_to_table(v_normalized, '\s+') as tokens(value)
            where value <> all(array['школа','школы','сош','лицей','гимназия','детский','сад','садик','дс'])
          )
          and not exists (
            select 1
            from regexp_split_to_table(v_normalized, '\s+') as tokens(value)
            where value <> all(array['школа','школы','сош','лицей','гимназия','детский','сад','садик','дс'])
              and trim(regexp_replace(lower(s.name || ' ' || s.city), '[^0-9a-zа-яё]+', ' ', 'g')) not like '%' || value || '%'
          )
        )
        or trim(regexp_replace(lower(s.name || ' ' || s.city), '[^0-9a-zа-яё]+', ' ', 'g')) like '%' || v_normalized || '%'
      )
    order by rank, s.name, s.city
    limit 6
  ) match;

  return v_result;
end;
$$;

create function public.submit_catalog_intake(
  p_token text,
  p_request_key uuid,
  p_school_id uuid,
  p_institution_name text,
  p_city text,
  p_class_id uuid,
  p_group_name text,
  p_child_first_name text,
  p_child_last_name text,
  p_phone text,
  p_item_ids uuid[],
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_school public.schools%rowtype;
  v_class public.classes%rowtype;
  v_child public.children%rowtype;
  v_order public.parent_orders%rowtype;
  v_inquiry public.catalog_inquiries%rowtype;
  v_phone text;
  v_services jsonb;
  v_total numeric(12,2);
  v_requested_count integer;
  v_year integer := extract(year from current_date)::integer;
  v_academic_year text;
  v_public_name text;
begin
  select id into v_owner
  from public.profiles
  where public_catalog_token = p_token;

  if v_owner is null then raise exception 'Ссылка недействительна'; end if;
  if p_request_key is null then raise exception 'Повторите отправку'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));

  select * into v_inquiry
  from public.catalog_inquiries
  where owner_id = v_owner and request_key = p_request_key;

  if found then
    select * into v_order from public.parent_orders where id = v_inquiry.order_id;
    return jsonb_build_object(
      'inquiry_id', v_inquiry.id,
      'school_id', v_inquiry.school_id,
      'class_id', v_inquiry.class_id,
      'child_id', v_inquiry.child_id,
      'order_id', v_inquiry.order_id,
      'order_number', v_order.order_number,
      'institution', v_inquiry.institution,
      'group_name', v_inquiry.group_name
    );
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if char_length(v_phone) not between 10 and 15 then raise exception 'Проверьте номер телефона'; end if;
  if (select count(*) from public.catalog_inquiries where owner_id = v_owner and phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Заявка уже получена. Попробуйте позже';
  end if;
  if char_length(trim(coalesce(p_child_first_name, ''))) not between 1 and 100
    or char_length(trim(coalesce(p_child_last_name, ''))) not between 1 and 100 then
    raise exception 'Укажите имя и фамилию ребёнка';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'Комментарий слишком длинный'; end if;

  if p_school_id is not null then
    select * into v_school
    from public.schools
    where id = p_school_id and owner_id = v_owner and status = 'active';
    if not found then raise exception 'Школа или садик не найдены'; end if;
  else
    if char_length(trim(coalesce(p_institution_name, ''))) not between 2 and 160
      or char_length(trim(coalesce(p_city, ''))) not between 2 and 120 then
      raise exception 'Укажите название и населённый пункт';
    end if;

    select * into v_school
    from public.schools
    where owner_id = v_owner
      and status = 'active'
      and lower(trim(name)) = lower(trim(p_institution_name))
      and lower(trim(city)) = lower(trim(p_city))
    order by created_at
    limit 1;

    if not found then
      insert into public.schools(owner_id, name, city)
      values(v_owner, trim(p_institution_name), trim(p_city))
      returning * into v_school;
    end if;
  end if;

  if p_class_id is not null then
    select * into v_class
    from public.classes
    where id = p_class_id
      and owner_id = v_owner
      and school_id = v_school.id
      and status = 'active';
    if not found then raise exception 'Класс или группа не найдены'; end if;
  else
    if char_length(trim(coalesce(p_group_name, ''))) not between 1 and 60 then
      raise exception 'Укажите класс или группу';
    end if;

    v_academic_year := case
      when extract(month from current_date) >= 8 then v_year::text || '/' || (v_year + 1)::text
      else (v_year - 1)::text || '/' || v_year::text
    end;

    select * into v_class
    from public.classes
    where owner_id = v_owner
      and school_id = v_school.id
      and status = 'active'
      and lower(trim(name)) = lower(trim(p_group_name))
      and academic_year = v_academic_year
    limit 1;

    if not found then
      insert into public.classes(owner_id, school_id, name, academic_year, photo_session_name)
      values(v_owner, v_school.id, trim(p_group_name), v_academic_year, 'Фотосессия ' || trim(p_group_name))
      returning * into v_class;
    end if;
  end if;

  if exists (
    select 1 from public.children
    where class_id = v_class.id
      and status = 'active'
      and lower(trim(first_name)) = lower(trim(p_child_first_name))
      and lower(trim(last_name)) = lower(trim(p_child_last_name))
  ) then
    raise exception 'Ребёнок с таким именем уже есть в этом классе или группе';
  end if;

  v_public_name := trim(p_child_first_name) || ' ' || left(trim(p_child_last_name), 1) || '.';
  insert into public.children(owner_id, class_id, first_name, last_name, public_name)
  values(v_owner, v_class.id, trim(p_child_first_name), trim(p_child_last_name), v_public_name)
  returning * into v_child;

  select count(distinct item_id) into v_requested_count
  from unnest(coalesce(p_item_ids, '{}'::uuid[])) item_id;
  if v_requested_count not between 1 and 100 then raise exception 'Выберите услуги'; end if;

  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', ci.id,
    'name', ci.name,
    'price', ci.price,
    'type', ci.type,
    'preview_url', ci.preview_url,
    'preview_video_url', ci.preview_video_url,
    'category', ci.category
  ) order by ci.sort_order, ci.name), '[]'::jsonb), coalesce(sum(ci.price), 0)
  into v_requested_count, v_services, v_total
  from public.catalog_items ci
  where ci.owner_id = v_owner and ci.is_active and ci.id = any(p_item_ids);

  if v_requested_count <> (select count(distinct item_id) from unnest(p_item_ids) item_id) then
    raise exception 'Выбранная услуга недоступна';
  end if;

  insert into public.parent_orders(
    owner_id, class_id, child_id, order_number, selected_items,
    total_amount, parent_note, request_key
  ) values (
    v_owner, v_class.id, v_child.id, '', v_services,
    v_total, trim(coalesce(p_note, '')), p_request_key
  ) returning * into v_order;

  insert into public.catalog_inquiries(
    owner_id, request_key, institution, city, group_name, contact_name,
    phone, services, note, school_id, class_id, child_id, order_id
  ) values (
    v_owner, p_request_key, v_school.name, v_school.city, v_class.name,
    trim(p_child_last_name) || ' ' || trim(p_child_first_name), v_phone,
    v_services, trim(coalesce(p_note, '')), v_school.id, v_class.id, v_child.id, v_order.id
  ) returning * into v_inquiry;

  return jsonb_build_object(
    'inquiry_id', v_inquiry.id,
    'school_id', v_school.id,
    'class_id', v_class.id,
    'child_id', v_child.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'institution', v_school.name,
    'city', v_school.city,
    'group_name', v_class.name
  );
end;
$$;

revoke all on function public.search_catalog_institutions(text, text) from public, anon, authenticated;
revoke all on function public.submit_catalog_intake(text, uuid, uuid, text, text, uuid, text, text, text, text, uuid[], text) from public, anon, authenticated;
grant execute on function public.search_catalog_institutions(text, text) to anon, authenticated;
grant execute on function public.submit_catalog_intake(text, uuid, uuid, text, text, uuid, text, text, text, text, uuid[], text) to anon, authenticated;
