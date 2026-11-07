-- Map Telegram id → auth.users for email↔Telegram linking

create table if not exists public.telegram_accounts (
  telegram_id bigint primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists telegram_accounts_user_id_idx
  on public.telegram_accounts (user_id);

alter table public.telegram_accounts enable row level security;

-- Clients never touch this table; service role only
drop policy if exists telegram_accounts_select_own on public.telegram_accounts;
create policy telegram_accounts_select_own
  on public.telegram_accounts for select to authenticated
  using (user_id = auth.uid());

grant select on public.telegram_accounts to authenticated;
