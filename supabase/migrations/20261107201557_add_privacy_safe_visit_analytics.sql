create table public.public_page_visits (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  page_kind text not null check (page_kind in ('class', 'catalog')),
  school_id uuid references public.schools(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  open_count integer not null default 1 check (open_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_key, visitor_hash)
);

create index public_page_visits_owner_last_seen_idx
  on public.public_page_visits (owner_id, last_seen_at desc);
create index public_page_visits_school_idx
  on public.public_page_visits (school_id) where school_id is not null;

alter table public.public_page_visits enable row level security;

create policy "Owners can view their visit analytics"
on public.public_page_visits for select
to authenticated
using ((select auth.uid()) = owner_id);

grant select on public.public_page_visits to authenticated;
revoke all on public.public_page_visits from anon;

create or replace function public.record_public_visit(
  p_token text,
  p_page_kind text,
  p_visitor_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_school_id uuid;
  v_class_id uuid;
  v_source_key text;
begin
  if p_page_kind = 'class' then
    select c.owner_id, c.school_id, c.id
      into v_owner_id, v_school_id, v_class_id
      from public.classes c
      join public.schools s on s.id = c.school_id
     where c.public_token = p_token
       and c.status = 'active'
       and s.status = 'active'
       and (c.public_expires_at is null or c.public_expires_at > now());
    v_source_key := 'class:' || coalesce(v_class_id::text, '');
  elsif p_page_kind = 'catalog' then
    select p.id into v_owner_id
      from public.profiles p
     where p.public_catalog_token = p_token;
    v_source_key := 'catalog:' || coalesce(v_owner_id::text, '');
  else
    return jsonb_build_object('recorded', false);
  end if;

  if v_owner_id is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('recorded', false);
  end if;

  insert into public.public_page_visits (
    owner_id, source_key, page_kind, school_id, class_id, visitor_hash
  ) values (
    v_owner_id, v_source_key, p_page_kind, v_school_id, v_class_id, p_visitor_hash
  )
  on conflict (source_key, visitor_hash) do update set
    open_count = public.public_page_visits.open_count + 1,
    last_seen_at = now();

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.record_public_visit(text, text, text) from public, anon, authenticated;
grant execute on function public.record_public_visit(text, text, text) to service_role;
