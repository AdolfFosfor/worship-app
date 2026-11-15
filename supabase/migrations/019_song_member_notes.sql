-- Personal notes: one private note per member × song

create table if not exists public.song_member_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, member_id)
);

create index if not exists song_member_notes_song_id_idx
  on public.song_member_notes (song_id);

create index if not exists song_member_notes_member_id_idx
  on public.song_member_notes (member_id);

drop trigger if exists song_member_notes_set_updated_at on public.song_member_notes;
create trigger song_member_notes_set_updated_at
before update on public.song_member_notes
for each row execute function public.set_updated_at();

alter table public.song_member_notes enable row level security;

-- Private: only the author can read/write their note
drop policy if exists song_member_notes_select_own on public.song_member_notes;
create policy song_member_notes_select_own
  on public.song_member_notes for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.id = song_member_notes.member_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists song_member_notes_insert_own on public.song_member_notes;
create policy song_member_notes_insert_own
  on public.song_member_notes for insert to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members m
      join public.songs s on s.id = song_member_notes.song_id
      where m.id = song_member_notes.member_id
        and m.user_id = auth.uid()
        and m.workspace_id = song_member_notes.workspace_id
        and s.workspace_id = song_member_notes.workspace_id
    )
  );

drop policy if exists song_member_notes_update_own on public.song_member_notes;
create policy song_member_notes_update_own
  on public.song_member_notes for update to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.id = song_member_notes.member_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members m
      join public.songs s on s.id = song_member_notes.song_id
      where m.id = song_member_notes.member_id
        and m.user_id = auth.uid()
        and m.workspace_id = song_member_notes.workspace_id
        and s.workspace_id = song_member_notes.workspace_id
    )
  );

drop policy if exists song_member_notes_delete_own on public.song_member_notes;
create policy song_member_notes_delete_own
  on public.song_member_notes for delete to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.id = song_member_notes.member_id
        and m.user_id = auth.uid()
    )
  );
