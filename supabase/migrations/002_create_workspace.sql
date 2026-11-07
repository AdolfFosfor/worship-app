-- Atomic workspace + first administrator (bypasses INSERT…RETURNING RLS gap)

create or replace function public.create_workspace(
  p_name text,
  p_display_name text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
  v_code text;
  v_name text := trim(p_name);
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Name required';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.workspaces (name, invite_code, created_by)
      values (v_name, v_code, v_uid)
      returning * into v_ws;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;

  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (
    v_ws.id,
    v_uid,
    'administrator',
    nullif(trim(coalesce(p_display_name, '')), '')
  );

  return v_ws;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;

-- STABLE helpers miss same-statement rows on INSERT…RETURNING
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.member_role(p_workspace_id uuid)
returns public.member_role
language sql
volatile
security definer
set search_path = public
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
  limit 1;
$$;
