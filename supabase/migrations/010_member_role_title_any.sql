-- Титул роли — свободная подпись для любой роли (не только лидера)

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
