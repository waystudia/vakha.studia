do $$
declare
  v_definition text;
  v_marker text := 'if v_existing.id is not null then';
  v_preserve text := $preserve$
if v_existing.id is not null then
    select coalesce(jsonb_agg(
      case when coalesce((new_item->>'video_addon_requested')::boolean, false)
        then new_item || coalesce((
          select jsonb_strip_nulls(jsonb_build_object(
            'parent_video_path', old_item->>'parent_video_path',
            'parent_video_name', old_item->>'parent_video_name',
            'parent_video_content_type', old_item->>'parent_video_content_type'
          ))
          from jsonb_array_elements(v_existing.selected_items) old_item
          where old_item->>'id' = new_item->>'id' limit 1
        ), '{}'::jsonb)
        else new_item end
    ), '[]'::jsonb) into v_items
    from jsonb_array_elements(v_items) new_item;
$preserve$;
begin
  select pg_get_functiondef('public.submit_parent_order_v3(text,uuid,uuid[],uuid[],uuid,text,jsonb)'::regprocedure)
  into v_definition;
  if position('then 800 else 0 end' in v_definition) > 0 then
    v_definition := replace(v_definition, 'then 800 else 0 end', 'then 500 else 0 end');
  end if;
  if position('parent_video_path' in v_definition) = 0 and position(v_marker in v_definition) > 0 then
    v_definition := replace(v_definition, v_marker, v_preserve);
  end if;
  execute v_definition;
end;
$$;
