-- Library filters: artist, types, themes, time signature.
-- Tempo stays on bpm (slow 30–79 / medium 80–119 / fast 120–300).
-- sounding_key mirrors app/utils/music/keys.ts + capo.ts (sharps, capo shift).

create or replace function public.song_sounding_key(p_key text, p_capo integer)
returns text
language plpgsql
immutable
as $$
declare
  raw text := btrim(coalesce(p_key, ''));
  root text;
  minor boolean := false;
  capo integer := greatest(0, least(11, coalesce(p_capo, 0)));
  notes text[] := array['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  idx integer;
begin
  if raw = '' then
    raw := 'C';
  end if;

  if raw ~* 'm$' and not (right(raw, 3) ~* '^maj') then
    minor := true;
    root := regexp_replace(raw, 'm$', '', 'i');
  else
    root := raw;
  end if;

  root := btrim(root);
  if root = '' then
    root := 'C';
  else
    root := upper(left(root, 1)) || substring(root from 2);
  end if;

  root := case root
    when 'Db' then 'C#'
    when 'Eb' then 'D#'
    when 'Fb' then 'E'
    when 'Gb' then 'F#'
    when 'Ab' then 'G#'
    when 'Bb' then 'A#'
    when 'Cb' then 'B'
    when 'E#' then 'F'
    when 'B#' then 'C'
    else root
  end;

  idx := array_position(notes, root);
  if idx is null then
    idx := 1;
  end if;
  idx := ((idx - 1 + capo) % 12) + 1;
  root := notes[idx];

  if minor then
    return root || 'm';
  end if;
  return root;
end;
$$;

revoke all on function public.song_sounding_key(text, integer) from public;
grant execute on function public.song_sounding_key(text, integer) to authenticated, service_role;

alter table public.songs
  add column if not exists artist text,
  add column if not exists types text[] not null default '{}',
  add column if not exists themes text[] not null default '{}',
  add column if not exists time_signature text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'sounding_key'
  ) then
    alter table public.songs
      add column sounding_key text
      generated always as (public.song_sounding_key(key, capo)) stored;
  end if;
end $$;

comment on column public.songs.artist is
  'Optional performer; null until set in the song editor';
comment on column public.songs.types is
  'Song types: worship, praise, thanksgiving, prayer. Empty until set';
comment on column public.songs.themes is
  'Theme slugs or custom labels. Empty until set';
comment on column public.songs.time_signature is
  'Optional meter such as 4/4. Null until set';
comment on column public.songs.sounding_key is
  'Concert key after capo, sharp spelling. Generated from key and capo';

create or replace function public.songs_normalize_library()
returns trigger
language plpgsql
as $$
declare
  v_types text[];
  v_themes text[];
begin
  if new.artist is not null then
    new.artist := nullif(btrim(new.artist), '');
    if new.artist is not null and char_length(new.artist) > 120 then
      raise exception 'artist too long';
    end if;
  end if;

  if new.time_signature is not null then
    new.time_signature := nullif(btrim(new.time_signature), '');
    if new.time_signature is not null
      and new.time_signature !~ '^[1-9][0-9]?/[1-9][0-9]?$' then
      raise exception 'invalid time signature';
    end if;
  end if;

  if exists (
    select 1
    from unnest(coalesce(new.types, '{}'::text[])) as u(t)
    where u.t not in ('worship', 'praise', 'thanksgiving', 'prayer')
  ) then
    raise exception 'unknown song type';
  end if;

  select coalesce(array_agg(s.t order by s.t), '{}'::text[])
    into v_types
  from (
    select distinct u.t
    from unnest(coalesce(new.types, '{}'::text[])) as u(t)
  ) s;
  new.types := v_types;

  if exists (
    select 1
    from unnest(coalesce(new.themes, '{}'::text[])) as u(t)
    where char_length(btrim(u.t)) > 40
  ) then
    raise exception 'theme too long';
  end if;

  select coalesce(array_agg(s.theme order by s.ord), '{}'::text[])
    into v_themes
  from (
    select btrim(u.t) as theme, min(u.ord)::integer as ord
    from unnest(coalesce(new.themes, '{}'::text[])) with ordinality as u(t, ord)
    where char_length(btrim(u.t)) > 0
    group by btrim(u.t)
  ) s;

  if cardinality(v_themes) > 12 then
    raise exception 'too many themes';
  end if;

  new.themes := v_themes;
  return new;
end;
$$;

drop trigger if exists songs_normalize_library on public.songs;
create trigger songs_normalize_library
before insert or update on public.songs
for each row execute function public.songs_normalize_library();

create index if not exists songs_types_gin on public.songs using gin (types);
create index if not exists songs_themes_gin on public.songs using gin (themes);
create index if not exists songs_workspace_sounding_key_idx
  on public.songs (workspace_id, sounding_key);

-- Activity ids for the library filter.
-- frequent: >= 3 distinct setlist plays in the last 365 days.
-- new / stale: same windows as repertoire_pulse_songs (12m, cooling and quieter).
create or replace function public.song_activity_ids(
  p_workspace_id uuid,
  p_kinds text[],
  p_today date
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kinds text[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if p_today is null then
    return '{}'::uuid[];
  end if;

  select coalesce(array_agg(distinct k), '{}'::text[])
    into v_kinds
  from unnest(coalesce(p_kinds, '{}'::text[])) as k
  where k in ('frequent', 'new', 'stale');

  if cardinality(v_kinds) = 0 then
    return '{}'::uuid[];
  end if;

  return coalesce((
    with plays as (
      select distinct sl.id as setlist_id, sl.service_date, si.song_id
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      where sl.workspace_id = p_workspace_id
        and sl.service_date < p_today
    ),
    lifetime as (
      select
        song_id,
        min(service_date) as first_date,
        max(service_date) as last_date,
        count(*)::integer as total_all,
        count(*) filter (where service_date >= p_today - 365)::integer as count_12m
      from plays
      group by song_id
    )
    select array_agg(song_id)
    from lifetime
    where (
      'frequent' = any (v_kinds)
      and count_12m >= 3
    ) or (
      'new' = any (v_kinds)
      and first_date >= p_today - 365
      and first_date < p_today
    ) or (
      'stale' = any (v_kinds)
      and total_all >= 2
      and first_date < p_today - 90
      and last_date <= p_today - 60
    )
  ), '{}'::uuid[]);
end;
$$;

revoke all on function public.song_activity_ids(uuid, text[], date) from public;
grant execute on function public.song_activity_ids(uuid, text[], date) to authenticated;

create or replace function public.song_library_facets(p_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'themes', coalesce((
      select jsonb_agg(theme order by theme)
      from (
        select distinct btrim(t) as theme
        from public.songs s
        cross join lateral unnest(s.themes) as t
        where s.workspace_id = p_workspace_id
          and char_length(btrim(t)) > 0
      ) themes
    ), '[]'::jsonb),
    'timeSignatures', coalesce((
      select jsonb_agg(sig order by sig)
      from (
        select distinct s.time_signature as sig
        from public.songs s
        where s.workspace_id = p_workspace_id
          and s.time_signature is not null
      ) meters
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.song_library_facets(uuid) from public;
grant execute on function public.song_library_facets(uuid) to authenticated;
