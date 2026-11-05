begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000108','crm-import-test@example.invalid');
insert into storage.objects(bucket_id,name) values('crm-project-imports','10000000-0000-4000-8000-000000000108/test.zip');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000108',true);
set local role authenticated;
do $$
declare payload jsonb; result jsonb; first_child uuid;
begin
 payload:=jsonb_build_object(
 'projects',jsonb_build_array(jsonb_build_object('id','qa-p1','name','Школа 1'),jsonb_build_object('id','qa-p2','name','Школа 2')),
 'classes',jsonb_build_array(jsonb_build_object('id','qa-c1','projectId','qa-p1','name','1 А','teacher',jsonb_build_object('name','Учитель','phone','79990000000','contacts','Контакт')),jsonb_build_object('id','qa-c2','projectId','qa-p2','name','2 А')),
 'students',(select jsonb_agg(jsonb_build_object('id','qa-s'||i,'classId',case when i<=177 then 'qa-c1' else 'qa-c2' end,'firstName','Али','lastName','Алиев '||i,'selectedServices',case when i=1 then '[{"serviceId":"qa-service","quantity":2,"comment":"Пожелание"}]'::jsonb else '[]'::jsonb end)) from generate_series(1,432)i),
 'services','[{"id":"qa-service","name":"Фото","price":350}]'::jsonb,'orders','[]'::jsonb);
 result:=public.import_crm_project(payload,'Грозный','2026/2027','10000000-0000-4000-8000-000000000108/test.zip');
 if (result->>'children')::int<>432 then raise exception 'wrong child count'; end if;
 if (select count(*) from public.children c join public.classes k on c.class_id=k.id where k.crm_source_id='qa-c1')<>177 then raise exception 'wrong first class'; end if;
 if (select count(*) from public.children c join public.classes k on c.class_id=k.id where k.crm_source_id='qa-c2')<>255 then raise exception 'wrong second class'; end if;
 if not exists(select 1 from public.classes where teacher_phone='79990000000' and teacher_contacts='Контакт') then raise exception 'teacher contacts lost'; end if;
 if not exists(select 1 from public.parent_orders where total_amount=700 and selected_items#>>'{0,quantity}'='2') then raise exception 'quantities lost'; end if;
 select id into first_child from public.children where crm_source_id='qa-s1';
 perform public.import_crm_project(payload,'Грозный','2026/2027','10000000-0000-4000-8000-000000000108/test.zip');
 if (select count(*) from public.children)<>432 or (select count(*) from public.parent_orders)<>1 or not exists(select 1 from public.children where id=first_child) then raise exception 'repeat import duplicated records'; end if;
 begin
  perform public.import_crm_project(jsonb_set(payload,'{students,0,classId}','"orphan"'),'Грозный','2026/2027','10000000-0000-4000-8000-000000000108/test.zip');
  raise exception 'orphan accepted';
 exception when others then if sqlerrm='orphan accepted' then raise; end if; end;
 if (select count(*) from public.children)<>432 then raise exception 'failed import changed records'; end if;
 begin
  perform public.import_crm_project(payload,'Грозный','2026/2027','someone-else/test.zip');
  raise exception 'foreign archive accepted';
 exception when others then if sqlerrm='foreign archive accepted' then raise; end if; end;
end $$;
rollback;
