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
      'preview_url', ci.preview_url, 'preview_video_url', ci.preview_video_url, 'parent_preview_mode', ci.parent_preview_mode
    ) order by ci.sort_order, ci.name) from public.catalog_items ci where ci.owner_id = v_profile.id and ci.is_active = true), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_catalog(text) from public, anon, authenticated;
grant execute on function public.get_public_catalog(text) to anon, authenticated;
