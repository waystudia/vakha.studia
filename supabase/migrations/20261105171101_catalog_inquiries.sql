create table public.catalog_inquiries (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 request_key uuid not null, institution text not null, contact_name text not null, phone text not null,
 services jsonb not null, note text not null default '', status text not null default 'new' check(status in ('new','contacted','closed')),
 created_at timestamptz not null default now(), unique(owner_id, request_key)
);
alter table public.catalog_inquiries enable row level security;
revoke all on public.catalog_inquiries from anon, authenticated;
grant select on public.catalog_inquiries to authenticated;
grant update(status) on public.catalog_inquiries to authenticated;
create policy owner_read on public.catalog_inquiries for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_update on public.catalog_inquiries for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create index on public.catalog_inquiries(owner_id, created_at desc);
create function public.submit_catalog_inquiry(p_token text,p_request_key uuid,p_institution text,p_contact_name text,p_phone text,p_item_ids uuid[],p_note text default '') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid; v_id uuid; v_services jsonb; v_phone text;
begin
 select id into v_owner from public.profiles where public_catalog_token=p_token;
 if v_owner is null then raise exception 'Ссылка недействительна'; end if;
 if p_request_key is null then raise exception 'Повторите отправку'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text,0));
 select id into v_id from public.catalog_inquiries where owner_id=v_owner and request_key=p_request_key;
 if v_id is not null then return v_id; end if;
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if length(trim(coalesce(p_institution,''))) not between 2 and 200 or length(trim(coalesce(p_contact_name,''))) not between 3 and 160 or length(v_phone) not between 10 and 15 or length(coalesce(p_note,''))>1000 then raise exception 'Проверьте название учреждения, имя и телефон'; end if;
 if coalesce(cardinality(p_item_ids),0) not between 1 and 100 then raise exception 'Выберите услуги'; end if;
 select jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price)) into v_services from public.catalog_items where owner_id=v_owner and is_active and id=any(p_item_ids);
 if coalesce(jsonb_array_length(v_services),0)<>(select count(distinct x) from unnest(p_item_ids) x) then raise exception 'Выбранная услуга недоступна'; end if;
 if (select count(*) from public.catalog_inquiries where owner_id=v_owner and phone=v_phone and created_at>now()-interval '1 hour')>=3 then raise exception 'Заявка уже получена. Попробуйте позже'; end if;
 insert into public.catalog_inquiries(owner_id,request_key,institution,contact_name,phone,services,note) values(v_owner,p_request_key,trim(p_institution),trim(p_contact_name),v_phone,v_services,trim(coalesce(p_note,''))) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.submit_catalog_inquiry(text,uuid,text,text,text,uuid[],text) from public;
grant execute on function public.submit_catalog_inquiry(text,uuid,text,text,text,uuid[],text) to anon,authenticated;
