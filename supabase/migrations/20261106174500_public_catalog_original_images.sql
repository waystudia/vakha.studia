create or replace function public.get_public_catalog(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare v_profile public.profiles%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_profile from public.profiles where public_catalog_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'company_name', v_profile.company_name,
    'whatsapp', jsonb_build_object('phone', v_profile.whatsapp_phone, 'company', v_profile.company_name, 'manager', v_profile.manager_name),
    'watermark', jsonb_build_object('text', v_profile.watermark_text, 'image', v_profile.watermark_image, 'opacity', v_profile.watermark_opacity),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ci.id, 'name', ci.name, 'description', ci.description, 'short_description', ci.short_description,
      'type', ci.type, 'category', ci.category, 'gender', ci.gender, 'price', ci.price,
      'preview_url', ci.preview_url, 'original_url', ci.original_url,
      'preview_video_url', ci.preview_video_url, 'parent_preview_mode', ci.parent_preview_mode
    ) order by ci.sort_order, ci.name) from public.catalog_items ci where ci.owner_id = v_profile.id and ci.is_active = true), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_catalog(text) from public, anon, authenticated;
grant execute on function public.get_public_catalog(text) to anon, authenticated;

create or replace function public.get_public_class(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_school public.schools%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_class from public.classes
  where public_token = p_token and status = 'active'
    and (public_expires_at is null or public_expires_at > now());
  if not found then return null; end if;
  select * into v_school from public.schools where id = v_class.school_id and status = 'active';
  if not found then return null; end if;
  return jsonb_build_object(
    'school', jsonb_build_object('name', v_school.name, 'city', v_school.city),
    'whatsapp', coalesce((select jsonb_build_object('phone', p.whatsapp_phone, 'company', p.company_name, 'manager', p.manager_name, 'template', p.whatsapp_template) from public.profiles p where p.id = v_class.owner_id), '{}'::jsonb),
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name, 'academic_year', v_class.academic_year, 'photo_session_name', v_class.photo_session_name),
    'children', coalesce((select jsonb_agg(jsonb_build_object('id', ch.id, 'public_name', trim(ch.last_name || ' ' || ch.first_name), 'orders', coalesce((select jsonb_agg(jsonb_build_object('status', o.status, 'items', (select jsonb_agg(jsonb_build_object('id', i->>'id', 'preview_url', i->>'preview_url', 'name', i->>'name', 'quantity', coalesce(i->'quantity', '1'::jsonb))) from jsonb_array_elements(o.selected_items) i)) order by o.created_at desc) from public.parent_orders o where o.child_id = ch.id and o.class_id = v_class.id and o.status <> 'cancelled'), '[]'::jsonb)) order by ch.public_name) from public.children ch where ch.class_id = v_class.id and ch.status = 'active'), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ci.id, 'name', ci.name, 'description', ci.description, 'short_description', ci.short_description,
      'type', ci.type, 'category', ci.category, 'gender', ci.gender, 'price', ci.price,
      'preview_url', ci.preview_url, 'original_url', ci.original_url,
      'preview_video_url', ci.preview_video_url, 'parent_preview_mode', ci.parent_preview_mode
    ) order by ci.sort_order, ci.name) from public.catalog_items ci where ci.owner_id = v_class.owner_id and ci.is_active = true), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_class(text) from public, anon, authenticated;
grant execute on function public.get_public_class(text) to anon, authenticated;
