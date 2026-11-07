-- Worship Team MVP schema + RLS (idempotent)

create extension if not exists "pgcrypto";

do $$ begin
  create type public.member_role as enum (
    'administrator',
    'worship_leader',
    'musician'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'musician',
  display_name text,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  key text not null default 'C',
  chords text,
  lyrics text,
  youtube_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  service_date date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete restrict,
  position integer not null check (position >= 0),
  key text,
  unique (setlist_id, position)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists songs_workspace_title_idx on public.songs (workspace_id, title);
create index if not exists setlists_workspace_date_idx on public.setlists (workspace_id, service_date desc);
create index if not exists setlist_items_setlist_position_idx on public.setlist_items (setlist_id, position);
create index if not exists setlist_items_song_id_idx on public.setlist_items (song_id);
create index if not exists workspaces_invite_code_idx on public.workspaces (invite_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

drop trigger if exists setlists_set_updated_at on public.setlists;
create trigger setlists_set_updated_at
before update on public.setlists
for each row execute function public.set_updated_at();

-- Membership helpers (security definer to avoid RLS recursion)
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

create or replace function public.can_manage_content(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role(p_workspace_id) in ('administrator', 'worship_leader');
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role(p_workspace_id) = 'administrator';
$$;

create or replace function public.setlist_workspace_id(p_setlist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.workspace_id from public.setlists s where s.id = p_setlist_id;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_items enable row level security;

-- Workspaces: members only (invite lookup goes through RPC)
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_authenticated on public.workspaces;
create policy workspaces_insert_authenticated
  on public.workspaces for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

drop policy if exists workspaces_delete_admin on public.workspaces;
create policy workspaces_delete_admin
  on public.workspaces for delete to authenticated
  using (public.is_workspace_admin(id));

-- Members
drop policy if exists members_select_peer on public.workspace_members;
create policy members_select_peer
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists members_insert_self_or_admin on public.workspace_members;
create policy members_insert_self_or_admin
  on public.workspace_members for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'musician')
    or public.is_workspace_admin(workspace_id)
    or (
      user_id = auth.uid()
      and role = 'administrator'
      and not exists (
        select 1 from public.workspace_members m where m.workspace_id = workspace_id
      )
    )
  );

drop policy if exists members_update_admin on public.workspace_members;
create policy members_update_admin
  on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists members_delete_admin_or_self on public.workspace_members;
create policy members_delete_admin_or_self
  on public.workspace_members for delete to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    or user_id = auth.uid()
  );

-- Songs
drop policy if exists songs_select_member on public.songs;
create policy songs_select_member
  on public.songs for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists songs_insert_leaders on public.songs;
create policy songs_insert_leaders
  on public.songs for insert to authenticated
  with check (public.can_manage_content(workspace_id));

drop policy if exists songs_update_leaders on public.songs;
create policy songs_update_leaders
  on public.songs for update to authenticated
  using (public.can_manage_content(workspace_id))
  with check (public.can_manage_content(workspace_id));

drop policy if exists songs_delete_leaders on public.songs;
create policy songs_delete_leaders
  on public.songs for delete to authenticated
  using (public.can_manage_content(workspace_id));

-- Setlists
drop policy if exists setlists_select_member on public.setlists;
create policy setlists_select_member
  on public.setlists for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists setlists_insert_leaders on public.setlists;
create policy setlists_insert_leaders
  on public.setlists for insert to authenticated
  with check (public.can_manage_content(workspace_id));

drop policy if exists setlists_update_leaders on public.setlists;
create policy setlists_update_leaders
  on public.setlists for update to authenticated
  using (public.can_manage_content(workspace_id))
  with check (public.can_manage_content(workspace_id));

drop policy if exists setlists_delete_leaders on public.setlists;
create policy setlists_delete_leaders
  on public.setlists for delete to authenticated
  using (public.can_manage_content(workspace_id));

-- Setlist items
drop policy if exists setlist_items_select_member on public.setlist_items;
create policy setlist_items_select_member
  on public.setlist_items for select to authenticated
  using (public.is_workspace_member(public.setlist_workspace_id(setlist_id)));

drop policy if exists setlist_items_insert_leaders on public.setlist_items;
create policy setlist_items_insert_leaders
  on public.setlist_items for insert to authenticated
  with check (public.can_manage_content(public.setlist_workspace_id(setlist_id)));

drop policy if exists setlist_items_update_leaders on public.setlist_items;
create policy setlist_items_update_leaders
  on public.setlist_items for update to authenticated
  using (public.can_manage_content(public.setlist_workspace_id(setlist_id)))
  with check (public.can_manage_content(public.setlist_workspace_id(setlist_id)));

drop policy if exists setlist_items_delete_leaders on public.setlist_items;
create policy setlist_items_delete_leaders
  on public.setlist_items for delete to authenticated
  using (public.can_manage_content(public.setlist_workspace_id(setlist_id)));

-- Create workspace + first administrator atomically
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

-- Invite join without exposing all workspaces
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
  values (
    v_ws.id,
    v_uid,
    'musician',
    nullif(trim(coalesce(p_display_name, '')), '')
  )
  on conflict (workspace_id, user_id) do nothing;

  return v_ws;
end;
$$;

grant execute on function public.join_workspace_by_invite(text, text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
