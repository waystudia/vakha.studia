begin;
alter table public.schools add column if not exists crm_source_id text, add column if not exists crm_source_data jsonb, add column if not exists crm_archive_path text;
alter table public.classes add column if not exists crm_source_id text, add column if not exists crm_source_data jsonb, add column if not exists teacher_phone text not null default '', add column if not exists teacher_contacts text not null default '';
alter table public.children add column if not exists crm_source_id text, add column if not exists crm_source_data jsonb;
create unique index if not exists schools_crm_source_unique on public.schools(owner_id,crm_source_id);
create unique index if not exists classes_crm_source_unique on public.classes(owner_id,crm_source_id);
create unique index if not exists children_crm_source_unique on public.children(owner_id,crm_source_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crm-project-imports','crm-project-imports',false,52428800,array['application/zip']) on conflict(id) do nothing;
create policy crm_project_archive_owner on storage.objects for all to authenticated
using(bucket_id='crm-project-imports' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='crm-project-imports' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.import_crm_project(payload jsonb, default_city text, default_year text, archive_path text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 uid uuid:=auth.uid(); r jsonb; s jsonb; selected jsonb; item jsonb; service public.catalog_items%rowtype;
 school_id_new uuid; class_id_new uuid; child_id_new uuid; source_service text; quantity integer; total numeric; unit_price numeric;
 school_count integer:=0; class_count integer:=0; child_count integer:=0; order_count integer:=0;
begin
 if uid is null then raise exception 'Войдите в аккаунт'; end if;
 if archive_path not like uid::text || '/%' then raise exception 'Архив другого пользователя'; end if;
 if not exists(select 1 from storage.objects where bucket_id='crm-project-imports' and name=archive_path) then raise exception 'Сначала сохраните исходный ZIP'; end if;
 if jsonb_typeof(payload->'projects')<>'array' or jsonb_array_length(payload->'projects')=0 or jsonb_array_length(payload->'students')>20000 then raise exception 'Неверный формат проекта'; end if;
 -- Existing catalog edits and media are preserved. Missing services get source IDs for linking.
 for r in select value from jsonb_array_elements(coalesce(payload->'services','[]')) loop
  insert into public.catalog_items(owner_id,source_id,name,price,category,type,gender,description,source)
  values(uid,r->>'id',coalesce(nullif(r->>'name',''),r->>'title'),greatest(coalesce(nullif(r->>'price','')::numeric,0),0),coalesce(r->>'category',''),coalesce(r->>'type','photo'),case when r->>'gender' in ('boys','girls') then r->>'gender' else 'unisex' end,coalesce(r->>'description',''),'crm_project')
  on conflict(owner_id,source_id) do nothing;
 end loop;
 for r in select value from jsonb_array_elements(payload->'projects') loop
  if coalesce(r->>'id','')='' then raise exception 'Пустой ID школы'; end if;
  insert into public.schools(owner_id,name,city,address,contact_name,crm_source_id,crm_source_data,crm_archive_path)
  values(uid,r->>'name',coalesce(nullif(r->>'city',''),nullif(trim(default_city),'')),coalesce(r->>'address',''),coalesce(r->>'contactName',''),r->>'id',r,archive_path)
  on conflict(owner_id,crm_source_id) do update set name=excluded.name, city=excluded.city,address=excluded.address,contact_name=excluded.contact_name,crm_source_data=excluded.crm_source_data,crm_archive_path=excluded.crm_archive_path;
  school_count:=school_count+1;
 end loop;
 for r in select value from jsonb_array_elements(payload->'classes') loop
  if coalesce(r->>'id','')='' or not exists(select 1 from jsonb_array_elements(payload->'projects') p where p->>'id'=r->>'projectId') then raise exception 'Класс без школы в архиве'; end if;
  select id into strict school_id_new from public.schools where owner_id=uid and crm_source_id=r->>'projectId';
  insert into public.classes(owner_id,school_id,name,academic_year,teacher_name,teacher_phone,teacher_contacts,crm_source_id,crm_source_data)
  values(uid,school_id_new,r->>'name',coalesce(nullif(r->>'academicYear',''),default_year),coalesce(r#>>'{teacher,name}',r->>'teacherName',''),coalesce(r#>>'{teacher,phone}',''),coalesce(r#>>'{teacher,contacts}',''),r->>'id',r)
  on conflict(owner_id,crm_source_id) do update set school_id=excluded.school_id,name=excluded.name,academic_year=excluded.academic_year,teacher_name=excluded.teacher_name,teacher_phone=excluded.teacher_phone,teacher_contacts=excluded.teacher_contacts,crm_source_data=excluded.crm_source_data;
  class_count:=class_count+1;
 end loop;
 for r in select value from jsonb_array_elements(payload->'students') loop
  if coalesce(r->>'id','')='' or not exists(select 1 from jsonb_array_elements(payload->'classes') c where c->>'id'=r->>'classId') then raise exception 'Ребёнок без класса в архиве'; end if;
  select id into strict class_id_new from public.classes where owner_id=uid and crm_source_id=r->>'classId';
  if exists(select 1 from public.children c join public.parent_orders o on o.child_id=c.id where c.owner_id=uid and c.crm_source_id=r->>'id' and c.class_id<>class_id_new) then raise exception 'Нельзя перенести ребёнка с заявками в другой класс через импорт'; end if;
  insert into public.children(owner_id,class_id,first_name,last_name,public_name,crm_source_id,crm_source_data)
  values(uid,class_id_new,trim(r->>'firstName'),trim(r->>'lastName'),coalesce(nullif(r->>'publicName',''),trim(r->>'firstName')||' '||left(trim(r->>'lastName'),1)||'.'),r->>'id',jsonb_build_object('student',r,'orders',(select coalesce(jsonb_agg(o),'[]') from jsonb_array_elements(coalesce(payload->'orders','[]')) o where o->>'studentId'=r->>'id')))
  on conflict(owner_id,crm_source_id) do update set class_id=excluded.class_id,first_name=excluded.first_name,last_name=excluded.last_name,public_name=excluded.public_name,crm_source_data=excluded.crm_source_data
  returning id into child_id_new;
  child_count:=child_count+1;
  if exists(select 1 from public.parent_orders where child_id=child_id_new and status<>'cancelled') then continue; end if;
  selected:='[]';total:=0;
  for s in select value from jsonb_array_elements(case when jsonb_array_length(coalesce(r->'selectedServices','[]'))>0 then r->'selectedServices' else (select coalesce(jsonb_agg(jsonb_build_object('serviceId',v)),'[]') from jsonb_array_elements_text(coalesce(r->'catalogIds',case when coalesce(r->>'catalogId','')<>'' then jsonb_build_array(r->>'catalogId') else '[]'::jsonb end)) v) end) loop
   source_service:=s->>'serviceId';
   select * into service from public.catalog_items where owner_id=uid and source_id=source_service;
   if not found then raise exception 'Не найдена выбранная услуга: %',source_service; end if;
   quantity:=greatest(1,least(999,coalesce(nullif(s->>'quantity','')::integer,1)));
   select coalesce(nullif(value->>'price','')::numeric,service.price) into unit_price from jsonb_array_elements(coalesce(payload->'services','[]')) where value->>'id'=source_service;
   unit_price:=greatest(0,coalesce(unit_price,service.price));
   item:=jsonb_build_object('id',service.id,'name',service.name,'price',unit_price,'type',service.type,'preview_url',service.preview_url,'category',service.category,'quantity',quantity,'comment',coalesce(s->>'comment',''));
   selected:=selected||jsonb_build_array(item); total:=total+unit_price*quantity;
  end loop;
  if jsonb_array_length(selected)>0 then
   insert into public.parent_orders(owner_id,class_id,child_id,selected_items,total_amount,request_key,parent_note)
   values(uid,class_id_new,child_id_new,selected,total,gen_random_uuid(),'Перенесено из CRM Photo');
   order_count:=order_count+1;
  end if;
 end loop;
 return jsonb_build_object('schools',school_count,'classes',class_count,'children',child_count,'orders',order_count);
end;
$$;
revoke all on function public.import_crm_project(jsonb,text,text,text) from public,anon;
grant execute on function public.import_crm_project(jsonb,text,text,text) to authenticated;
commit;
