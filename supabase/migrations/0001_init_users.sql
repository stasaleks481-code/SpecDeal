-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SPEC DEAL — Initial schema migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable extensions
create extension if not exists "pgcrypto";

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- USERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.users (
  id                uuid        primary key default gen_random_uuid(),
  telegram_id       bigint      not null unique,                 -- Telegram user id (numeric)
  username          text,                                         -- @handle (without @), nullable
  first_name        text,
  last_name         text,
  language_code     text,

  -- Economy
  balance_cr        numeric(20, 2) not null default 50000,      -- Credits, starting: $50,000
  balance_sp        integer        not null default 0,          -- Spec Points (premium)
  bank_deposit       numeric(20, 2) not null default 0,          -- Money deposited in bank (earns 1.5%/day)
  bank_loan          numeric(20, 2) not null default 0,          -- Active loan amount
  bank_loan_due_at   timestamptz,                                -- When loan must be repaid

  -- Progression
  level             integer      not null default 1,
  xp                integer      not null default 0,
  reputation        integer      not null default 0,            -- 0..5000, affects market prices
  garage_slots      integer      not null default 3,            -- Number of cars the player can own at once

  -- Stats
  successful_deals  integer      not null default 0,
  races_won         integer      not null default 0,
  races_total       integer      not null default 0,

  -- Housekeeping
  is_banned         boolean      not null default false,
  last_seen_at      timestamptz  not null default now(),
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

-- Helpful index for non-telegram_id queries (e.g. leaderboard by reputation)
create index if not exists idx_users_reputation on public.users (reputation desc);
create index if not exists idx_users_level      on public.users (level desc);
create index if not exists idx_users_username   on public.users (username) where username is not null;

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROW LEVEL SECURITY (RLS)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- The Telegram bot uses the anon key, so we need a policy that lets it
-- read/write user rows. In production you should swap this for a more
-- locked-down policy (e.g. using a custom JWT signed by the bot that
-- includes the telegram_id claim).

alter table public.users enable row level security;

-- Allow anonymous read of users (needed for leaderboard / profile lookup).
-- Sensitive fields like balance are fine to expose because this is a game.
drop policy if exists "users_anon_select" on public.users;
create policy "users_anon_select"
  on public.users for select
  to anon, authenticated
  using (true);

-- Allow anonymous insert (bot creates new user rows on /start)
drop policy if exists "users_anon_insert" on public.users;
create policy "users_anon_insert"
  on public.users for insert
  to anon, authenticated
  with check (true);

-- Allow anonymous update (bot updates balance, stats etc.)
-- WARNING: this is permissive — for production consider restricting
-- updates to rows matching the JWT's telegram_id claim.
drop policy if exists "users_anon_update" on public.users;
create policy "users_anon_update"
  on public.users for update
  to anon, authenticated
  using (true)
  with check (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- COMMENTS (for documentation in Supabase Dashboard)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

comment on table public.users is
  'Player profiles. One row per Telegram user. Created on /start.';

comment on column public.users.balance_cr is
  'In-game credits — earned from sales, races, daily bonuses. Starting: 50000.';
comment on column public.users.balance_sp is
  'Spec Points — premium currency. Earned from achievements and events.';
comment on column public.users.reputation is
  '0..5000. Affects market prices and access to high-tier auctions.';
