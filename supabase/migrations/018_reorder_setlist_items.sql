-- Atomic setlist reorder (avoids unique(setlist_id, position) mid-update races).
-- Temp positions stay >= 0 (check constraint) and unique within the setlist.
create or replace function public.reorder_setlist_items(
  p_setlist_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
  expected_count int;
begin
  ws := public.setlist_workspace_id(p_setlist_id);
  if ws is null then
    raise exception 'setlist not found';
  end if;
  if not public.can_manage_content(ws) then
    raise exception 'forbidden';
  end if;

  if p_ordered_ids is null or cardinality(p_ordered_ids) = 0 then
    raise exception 'ordered ids required';
  end if;

  select count(*)::int into expected_count
  from public.setlist_items
  where setlist_id = p_setlist_id;

  if expected_count <> cardinality(p_ordered_ids) then
    raise exception 'item count mismatch';
  end if;

  if (
    select count(*)::int
    from public.setlist_items
    where setlist_id = p_setlist_id
      and id = any (p_ordered_ids)
  ) <> cardinality(p_ordered_ids) then
    raise exception 'invalid item ids';
  end if;

  -- Park every row in a unique high band so final 0..n-1 never collide mid-update.
  update public.setlist_items si
  set position = 2000000 + sub.rn
  from (
    select
      id,
      (row_number() over (order by position) - 1)::int as rn
    from public.setlist_items
    where setlist_id = p_setlist_id
  ) sub
  where si.id = sub.id;

  update public.setlist_items si
  set position = (u.ord - 1)::int
  from unnest(p_ordered_ids) with ordinality as u(id, ord)
  where si.id = u.id
    and si.setlist_id = p_setlist_id;
end;
$$;

grant execute on function public.reorder_setlist_items(uuid, uuid[]) to authenticated;
