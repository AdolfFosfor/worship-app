-- Re-join should refresh membership instead of silently no-op
create or replace function public.join_workspace_by_invite(
  p_code text,
  p_display_name text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws public.workspaces;
  v_uid uuid := auth.uid();
  v_display text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_ws
  from public.workspaces
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_ws.id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (v_ws.id, v_uid, 'musician', v_display)
  on conflict (workspace_id, user_id) do update
    set display_name = coalesce(excluded.display_name, public.workspace_members.display_name);

  return v_ws;
end;
$$;

grant execute on function public.join_workspace_by_invite(text, text) to authenticated;
