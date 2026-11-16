-- Draft / published lifecycle for setlists + RLS visibility

alter table public.setlists
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users (id) on delete set null;

do $$ begin
  alter table public.setlists
    add constraint setlists_status_check
    check (status in ('draft', 'published'));
exception
  when duplicate_object then null;
end $$;

-- Existing rows received default 'draft' — they were already team-visible
update public.setlists
set
  status = 'published',
  published_at = coalesce(published_at, created_at)
where status is distinct from 'published'
   or published_at is null;

alter table public.setlists alter column status set default 'draft';

create index if not exists setlists_workspace_status_date_idx
  on public.setlists (workspace_id, status, service_date desc);

create or replace function public.can_view_setlist(p_setlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.setlists s
    where s.id = p_setlist_id
      and public.is_workspace_member(s.workspace_id)
      and (
        s.status = 'published'
        or public.can_manage_content(s.workspace_id)
      )
  );
$$;

drop policy if exists setlists_select_member on public.setlists;
create policy setlists_select_member
  on public.setlists for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (
      status = 'published'
      or public.can_manage_content(workspace_id)
    )
  );

drop policy if exists setlist_items_select_member on public.setlist_items;
create policy setlist_items_select_member
  on public.setlist_items for select to authenticated
  using (public.can_view_setlist(setlist_id));

drop policy if exists setlist_rsvps_select_member on public.setlist_rsvps;
create policy setlist_rsvps_select_member
  on public.setlist_rsvps for select to authenticated
  using (public.can_view_setlist(setlist_id));

drop policy if exists setlist_rsvps_insert_own on public.setlist_rsvps;
create policy setlist_rsvps_insert_own
  on public.setlist_rsvps for insert to authenticated
  with check (
    public.can_view_setlist(setlist_id)
    and exists (
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
    public.can_view_setlist(setlist_id)
    and exists (
      select 1
      from public.workspace_members m
      where m.id = member_id
        and m.user_id = auth.uid()
        and m.workspace_id = public.setlist_workspace_id(setlist_id)
    )
  );
