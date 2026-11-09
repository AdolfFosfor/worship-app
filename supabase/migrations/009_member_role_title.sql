-- Альтернативное отображаемое имя роли (для лидеров: Отец, Суетолог и т.п.)

alter table public.workspace_members
  add column if not exists role_title text;

alter table public.workspace_members
  drop constraint if exists workspace_members_role_title_len;

alter table public.workspace_members
  add constraint workspace_members_role_title_len
  check (
    role_title is null
    or char_length(trim(role_title)) between 1 and 40
  );

create or replace function public.normalize_member_role_title()
returns trigger
language plpgsql
as $$
begin
  new.role_title := nullif(trim(coalesce(new.role_title, '')), '');
  return new;
end;
$$;

drop trigger if exists workspace_members_clear_role_title on public.workspace_members;
drop trigger if exists workspace_members_normalize_role_title on public.workspace_members;
create trigger workspace_members_normalize_role_title
before insert or update of role_title on public.workspace_members
for each row execute function public.normalize_member_role_title();

-- Известные лидеры с особыми титулами
update public.workspace_members
set
  role = 'worship_leader',
  role_title = 'Отец'
where display_name ilike '%gritsko%'
   or display_name ilike '%гритско%';

update public.workspace_members
set
  role = 'worship_leader',
  role_title = 'Суетолог'
where (
  display_name ilike '%владимир%'
  or display_name ilike '%vladimir%'
)
and (
  role_title is distinct from 'Отец'
);
