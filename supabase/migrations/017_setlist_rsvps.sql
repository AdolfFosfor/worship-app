-- RSVP / участие команды в конкретном служении (сет-листе)

do $$ begin
  create type public.setlist_rsvp_status as enum ('yes', 'maybe', 'no');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.setlist_rsvps (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  status public.setlist_rsvp_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setlist_id, member_id)
);

create index if not exists setlist_rsvps_setlist_id_idx
  on public.setlist_rsvps (setlist_id);

drop trigger if exists setlist_rsvps_set_updated_at on public.setlist_rsvps;
create trigger setlist_rsvps_set_updated_at
before update on public.setlist_rsvps
for each row execute function public.set_updated_at();

alter table public.setlist_rsvps enable row level security;

-- Читать могут все члены workspace этого сет-листа
drop policy if exists setlist_rsvps_select_member on public.setlist_rsvps;
create policy setlist_rsvps_select_member
  on public.setlist_rsvps for select to authenticated
  using (
    public.is_workspace_member(public.setlist_workspace_id(setlist_id))
  );

-- Писать можно только свой ответ, и только если членство в том же workspace
drop policy if exists setlist_rsvps_insert_own on public.setlist_rsvps;
create policy setlist_rsvps_insert_own
  on public.setlist_rsvps for insert to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members m
      where m.id = member_id
        and m.user_id = auth.uid()
        and m.workspace_id = public.setlist_workspace_id(setlist_id)
    )
  );

drop policy if exists setlist_rsvps_update_own on public.setlist_rsvps;
create policy setlist_rsvps_update_own
  on public.setlist_rsvps for update to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.id = member_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members m
      where m.id = member_id
        and m.user_id = auth.uid()
        and m.workspace_id = public.setlist_workspace_id(setlist_id)
    )
  );

drop policy if exists setlist_rsvps_delete_own on public.setlist_rsvps;
create policy setlist_rsvps_delete_own
  on public.setlist_rsvps for delete to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.id = member_id
        and m.user_id = auth.uid()
    )
  );
