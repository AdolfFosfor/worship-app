-- Repertoire pulse: aggregated stats from completed setlists (service_date < today).
-- No separate performance log — live joins on setlists + setlist_items.

create or replace function public.repertoire_pulse_summary(
  p_workspace_id uuid,
  p_from date,
  p_today date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_to date := p_today - 1;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if p_from is null or p_today is null or p_from >= p_today then
    return jsonb_build_object(
      'execution_count', 0,
      'unique_songs', 0,
      'new_songs', 0,
      'from', p_from,
      'to', v_to,
      'activity', '[]'::jsonb,
      'stale_hint', '[]'::jsonb
    );
  end if;

  return (
    with completed as (
      select sl.service_date, si.song_id
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      where sl.workspace_id = p_workspace_id
        and sl.service_date >= p_from
        and sl.service_date < p_today
    ),
    song_lifetime as (
      select
        si.song_id,
        min(sl.service_date) as first_date,
        max(sl.service_date) as last_date,
        count(*)::int as total_all
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      where sl.workspace_id = p_workspace_id
        and sl.service_date < p_today
      group by si.song_id
    ),
    metrics as (
      select
        (select count(*)::int from completed) as execution_count,
        (select count(distinct song_id)::int from completed) as unique_songs,
        (
          select count(*)::int
          from song_lifetime sl
          where sl.first_date >= p_from
            and sl.first_date < p_today
        ) as new_songs
    ),
    activity as (
      select service_date as d, count(*)::int as c
      from completed
      group by service_date
    ),
    stale_hint as (
      select
        s.id,
        s.title,
        lt.last_date,
        lt.total_all as total,
        lt.first_date
      from song_lifetime lt
      join public.songs s on s.id = lt.song_id
      where lt.total_all >= 2
        and lt.first_date < p_today - 90
        and lt.last_date <= p_today - 90
      order by lt.last_date asc
      limit 5
    )
    select jsonb_build_object(
      'execution_count', m.execution_count,
      'unique_songs', m.unique_songs,
      'new_songs', m.new_songs,
      'from', p_from,
      'to', v_to,
      'activity', coalesce(
        (
          select jsonb_agg(jsonb_build_object('d', a.d, 'c', a.c) order by a.d)
          from activity a
        ),
        '[]'::jsonb
      ),
      'stale_hint', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', sh.id,
              'title', sh.title,
              'last_date', sh.last_date,
              'total', sh.total,
              'first_date', sh.first_date
            )
            order by sh.last_date
          )
          from stale_hint sh
        ),
        '[]'::jsonb
      )
    )
    from metrics m
  );
end;
$$;

revoke all on function public.repertoire_pulse_summary(uuid, date, date) from public;
grant execute on function public.repertoire_pulse_summary(uuid, date, date) to authenticated;

create or replace function public.repertoire_pulse_songs(
  p_workspace_id uuid,
  p_from date,
  p_today date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if p_from is null or p_today is null or p_from >= p_today then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      with plays as (
        select sl.service_date, si.song_id
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
          count(*)::int as total_all
        from plays
        group by song_id
      ),
      period as (
        select
          song_id,
          count(*)::int as execution_count,
          count(*) filter (where service_date >= p_today - 30)::int as count_30,
          count(*) filter (where service_date >= p_today - 90)::int as count_90,
          count(*) filter (where service_date >= p_today - 365)::int as count_365
        from plays
        where service_date >= p_from
        group by song_id
      ),
      activity as (
        select
          song_id,
          jsonb_agg(jsonb_build_object('d', service_date, 'c', c) order by service_date) as activity
        from (
          select song_id, service_date, count(*)::int as c
          from plays
          where service_date >= p_from
          group by song_id, service_date
        ) daily
        group by song_id
      )
      select jsonb_agg(
        jsonb_build_object(
          'song_id', s.id,
          'title', s.title,
          'execution_count', coalesce(p.execution_count, 0),
          'count_30', coalesce(p.count_30, 0),
          'count_90', coalesce(p.count_90, 0),
          'count_365', coalesce(p.count_365, 0),
          'total_all', lt.total_all,
          'first_date', lt.first_date,
          'last_date', lt.last_date,
          'is_new_in_period', (lt.first_date >= p_from and lt.first_date < p_today),
          'activity', coalesce(a.activity, '[]'::jsonb)
        )
        order by coalesce(p.execution_count, 0) desc, s.title asc
      )
      from lifetime lt
      join public.songs s on s.id = lt.song_id
      left join period p on p.song_id = lt.song_id
      left join activity a on a.song_id = lt.song_id
      where coalesce(p.execution_count, 0) > 0
         or lt.last_date < p_from
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.repertoire_pulse_songs(uuid, date, date) from public;
grant execute on function public.repertoire_pulse_songs(uuid, date, date) to authenticated;

create or replace function public.repertoire_pulse_day(
  p_workspace_id uuid,
  p_day date,
  p_today date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if p_day is null or p_today is null or p_day >= p_today then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'setlist_id', sl.id,
          'setlist_title', sl.title,
          'song_id', s.id,
          'song_title', s.title,
          'position', si.position
        )
        order by sl.title, si.position
      )
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      join public.songs s on s.id = si.song_id
      where sl.workspace_id = p_workspace_id
        and sl.service_date = p_day
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.repertoire_pulse_day(uuid, date, date) from public;
grant execute on function public.repertoire_pulse_day(uuid, date, date) to authenticated;
