-- Allow custom song types (same rules as themes: trim, max 40, up to 12).

comment on column public.songs.types is
  'Type slugs or custom labels. Empty until set';

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
    where char_length(btrim(u.t)) > 40
  ) then
    raise exception 'type too long';
  end if;

  select coalesce(array_agg(s.typ order by s.ord), '{}'::text[])
    into v_types
  from (
    select btrim(u.t) as typ, min(u.ord)::integer as ord
    from unnest(coalesce(new.types, '{}'::text[])) with ordinality as u(t, ord)
    where char_length(btrim(u.t)) > 0
    group by btrim(u.t)
  ) s;

  if cardinality(v_types) > 12 then
    raise exception 'too many types';
  end if;

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
