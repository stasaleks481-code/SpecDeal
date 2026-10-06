-- ════════════════════════════════════════════════════════════════════
-- VoiceDeck migration 0006
-- 1. Currency + cosmetics: users.coins, avatar_frame, name_style, user_title
-- 2. inventory — owned cosmetic items (frames / name styles / titles)
-- 3. quest_progress — per-user daily quest progress & claims
-- 4. Per-category match counters (casual / party / pc)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. users: currency + equipped cosmetics + category counters ──────
alter table public.users add column if not exists coins integer not null default 0;
alter table public.users add column if not exists avatar_frame text;
alter table public.users add column if not exists name_style text;
alter table public.users add column if not exists user_title text;
alter table public.users add column if not exists casual_matches integer not null default 0;
alter table public.users add column if not exists party_matches integer not null default 0;
alter table public.users add column if not exists pc_matches integer not null default 0;

-- ── 2. inventory ─────────────────────────────────────────────────────
create table if not exists public.inventory (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  kind text not null,                          -- frame | name_style | title
  code text not null,
  acquired_at timestamptz not null default now(),
  constraint inventory_kind_check check (kind in ('frame', 'name_style', 'title')),
  constraint inventory_unique_item unique (user_id, kind, code)
);

create index if not exists idx_inventory_user on public.inventory (user_id, kind);

-- ── 3. quest_progress ────────────────────────────────────────────────
-- period: 'YYYY-MM-DD' (UTC) for dailies. quest_code references the
-- static catalog in the app code (no FK — catalog ships with releases).
create table if not exists public.quest_progress (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  quest_code text not null,
  period text not null,
  progress integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint quest_progress_unique unique (user_id, quest_code, period)
);

create index if not exists idx_quest_progress_user_period on public.quest_progress (user_id, period);

-- ── RLS: permissive (same model as the rest of the schema —
--    authorization is enforced by the Next.js API layer) ─────────────
alter table public.inventory enable row level security;
drop policy if exists inventory_anon_select on public.inventory;
create policy inventory_anon_select on public.inventory
  for select to anon, authenticated using (true);
drop policy if exists inventory_anon_insert on public.inventory;
create policy inventory_anon_insert on public.inventory
  for insert to anon, authenticated with check (true);
drop policy if exists inventory_anon_update on public.inventory;
create policy inventory_anon_update on public.inventory
  for update to anon, authenticated using (true) with check (true);
drop policy if exists inventory_anon_delete on public.inventory;
create policy inventory_anon_delete on public.inventory
  for delete to anon, authenticated using (true);

alter table public.quest_progress enable row level security;
drop policy if exists quest_progress_anon_select on public.quest_progress;
create policy quest_progress_anon_select on public.quest_progress
  for select to anon, authenticated using (true);
drop policy if exists quest_progress_anon_insert on public.quest_progress;
create policy quest_progress_anon_insert on public.quest_progress
  for insert to anon, authenticated with check (true);
drop policy if exists quest_progress_anon_update on public.quest_progress;
create policy quest_progress_anon_update on public.quest_progress
  for update to anon, authenticated using (true) with check (true);
drop policy if exists quest_progress_anon_delete on public.quest_progress;
create policy quest_progress_anon_delete on public.quest_progress
  for delete to anon, authenticated using (true);
