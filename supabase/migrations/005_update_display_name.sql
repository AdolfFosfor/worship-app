-- Allow each user to set their own display name across memberships
create or replace function public.update_my_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null then
    raise exception 'Name required';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Name too long';
  end if;

  update public.workspace_members
  set display_name = v_name
  where user_id = v_uid;

  return v_name;
end;
$$;

grant execute on function public.update_my_display_name(text) to authenticated;
