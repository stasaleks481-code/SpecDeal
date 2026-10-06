-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 0002 — Account types, Steam/TG linking, onboarding
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Account type: 'anonymous' (limited) | 'telegram' (primary TG) | 'steam' (primary Steam)
alter table public.users
  add column if not exists account_type text not null default 'telegram';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_account_type_check'
  ) then
    alter table public.users add constraint users_account_type_check
      check (account_type in ('anonymous', 'telegram', 'steam'));
  end if;
end $$;

-- Steam-primary accounts: linked Telegram profile (snapshot from initData at link time)
alter table public.users
  add column if not exists tg_link_data jsonb;  -- {id, username, first_name, last_name, photo_url}

-- Steam-primary accounts: privacy toggle — show TG profile to others
alter table public.users
  add column if not exists show_tg_profile boolean not null default true;

-- Onboarding tour completion flag (also mirrored client-side in localStorage)
alter table public.users
  add column if not exists onboarding_done boolean not null default false;

-- Indexes for new fields
create index if not exists idx_users_account_type on public.users (account_type);
create index if not exists idx_users_tg_link on public.users ((tg_link_data->>'id')) where tg_link_data is not null;

-- Existing users keep working: 'telegram' is the correct default for all
-- rows created through Telegram initData auth before this migration.
