-- Repertoire pulse v2: song-centric aggregates (spec: Worship Team repertoire analytics).
-- Play = distinct (setlist_id, song_id); completed = service_date < today.
-- Frequent = order by period execution_count desc, title asc (no hit threshold).
-- New = first_date in [p_from, p_today).
-- Stale = total_all >= 2 AND first_date < today-90 AND last_date <= today-60
--   tiers: cooling>=60 / stale>=90 / dormant>=180 (from last_date).
-- Frequent and stale are not mutually exclusive.

drop function if exists public.repertoire_pulse_day(uuid, date, date);

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
      'stale_count', 0,
      'from', p_from,
      'to', v_to,
      'stale_hint', '[]'::jsonb,
      'frequent_hint', '[]'::jsonb
    );
  end if;

  return (
    with plays as (
      select distinct sl.id as setlist_id, sl.service_date, si.song_id
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      where sl.workspace_id = p_workspace_id
        and sl.service_date < p_today
    ),
    song_lifetime as (
      select
        song_id,
        min(service_date) as first_date,
        max(service_date) as last_date,
        count(*)::int as total_all
      from plays
      group by song_id
    ),
    period_plays as (
      select *
      from plays
      where service_date >= p_from
    ),
    period_stats as (
      select
        song_id,
        count(*)::int as execution_count
      from period_plays
      group by song_id
    ),
    metrics as (
      select
        (select count(*)::int from period_plays) as execution_count,
        (select count(distinct song_id)::int from period_plays) as unique_songs,
        (
          select count(*)::int
          from song_lifetime sl
          where sl.first_date >= p_from
            and sl.first_date < p_today
        ) as new_songs,
        (
          select count(*)::int
          from song_lifetime sl
          where sl.total_all >= 2
            and sl.first_date < p_today - 90
            and sl.last_date <= p_today - 60
        ) as stale_count
    ),
    stale_hint as (
      select
        s.id,
        s.title,
        lt.last_date,
        lt.total_all as total,
        lt.first_date,
        case
          when lt.last_date <= p_today - 180 then 'dormant'
          when lt.last_date <= p_today - 90 then 'stale'
          else 'cooling'
        end as stale_tier
      from song_lifetime lt
      join public.songs s on s.id = lt.song_id
      where lt.total_all >= 2
        and lt.first_date < p_today - 90
        and lt.last_date <= p_today - 60
      order by lt.last_date asc
      limit 5
    ),
    frequent_hint as (
      select
        s.id,
        s.title,
        ps.execution_count as total,
        lt.last_date,
        lt.first_date
      from period_stats ps
      join song_lifetime lt on lt.song_id = ps.song_id
      join public.songs s on s.id = ps.song_id
      where ps.execution_count > 0
      order by ps.execution_count desc, s.title asc
      limit 5
    )
    select jsonb_build_object(
      'execution_count', m.execution_count,
      'unique_songs', m.unique_songs,
      'new_songs', m.new_songs,
      'stale_count', m.stale_count,
      'from', p_from,
      'to', v_to,
      'stale_hint', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', sh.id,
              'title', sh.title,
              'last_date', sh.last_date,
              'total', sh.total,
              'first_date', sh.first_date,
              'stale_tier', sh.stale_tier
            )
            order by sh.last_date
          )
          from stale_hint sh
        ),
        '[]'::jsonb
      ),
      'frequent_hint', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', fh.id,
              'title', fh.title,
              'last_date', fh.last_date,
              'total', fh.total,
              'first_date', fh.first_date
            )
            order by fh.total desc, fh.title
          )
          from frequent_hint fh
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
          'stale_tier', case
            when lt.total_all >= 2
              and lt.first_date < p_today - 90
              and lt.last_date <= p_today - 180 then 'dormant'
            when lt.total_all >= 2
              and lt.first_date < p_today - 90
              and lt.last_date <= p_today - 90 then 'stale'
            when lt.total_all >= 2
              and lt.first_date < p_today - 90
              and lt.last_date <= p_today - 60 then 'cooling'
            else null
          end,
          'activity', coalesce(a.activity, '[]'::jsonb)
        )
        order by coalesce(p.execution_count, 0) desc, s.title asc
      )
      from lifetime lt
      join public.songs s on s.id = lt.song_id
      left join period p on p.song_id = lt.song_id
      left join activity a on a.song_id = lt.song_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.repertoire_pulse_songs(uuid, date, date) from public;
grant execute on function public.repertoire_pulse_songs(uuid, date, date) to authenticated;

create or replace function public.repertoire_song_detail(
  p_workspace_id uuid,
  p_song_id uuid,
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
  if p_song_id is null or p_today is null then
    return null;
  end if;

  return (
    with plays as (
      select distinct sl.id as setlist_id, sl.title as setlist_title, sl.service_date
      from public.setlists sl
      join public.setlist_items si on si.setlist_id = sl.id
      where sl.workspace_id = p_workspace_id
        and si.song_id = p_song_id
        and sl.service_date < p_today
    ),
    song_row as (
      select s.id, s.title
      from public.songs s
      where s.id = p_song_id
        and s.workspace_id = p_workspace_id
    ),
    stats as (
      select
        count(*)::int as total_all,
        min(service_date) as first_date,
        max(service_date) as last_date
      from plays
    ),
    monthly as (
      select
        to_char(date_trunc('month', service_date::timestamp), 'YYYY-MM') as ym,
        count(*)::int as c
      from plays
      group by 1
      order by 1
    )
    select case
      when not exists (select 1 from song_row) then null
      when coalesce((select total_all from stats), 0) = 0 then
        jsonb_build_object(
          'song_id', (select id from song_row),
          'title', (select title from song_row),
          'total_all', 0,
          'first_date', null,
          'last_date', null,
          'performances', '[]'::jsonb,
          'monthly', '[]'::jsonb
        )
      else jsonb_build_object(
        'song_id', (select id from song_row),
        'title', (select title from song_row),
        'total_all', (select total_all from stats),
        'first_date', (select first_date from stats),
        'last_date', (select last_date from stats),
        'performances', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'setlist_id', p.setlist_id,
                'setlist_title', p.setlist_title,
                'service_date', p.service_date
              )
              order by p.service_date desc, p.setlist_title
            )
            from plays p
          ),
          '[]'::jsonb
        ),
        'monthly', coalesce(
          (
            select jsonb_agg(jsonb_build_object('ym', m.ym, 'c', m.c) order by m.ym)
            from monthly m
          ),
          '[]'::jsonb
        )
      )
    end
  );
end;
$$;

revoke all on function public.repertoire_song_detail(uuid, uuid, date) from public;
grant execute on function public.repertoire_song_detail(uuid, uuid, date) to authenticated;
