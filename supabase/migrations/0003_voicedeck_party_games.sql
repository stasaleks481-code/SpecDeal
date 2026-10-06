-- ════════════════════════════════════════════════════════════════════
-- VoiceDeck migration 0003
-- 1. rooms: skill_level (PC LFG), game_type + game_settings (party games)
-- 2. game_sessions table — server-authoritative party game state
-- 3. One-time ghost-room cleanup
-- ════════════════════════════════════════════════════════════════════

-- ── 1. rooms ─────────────────────────────────────────────────────────
-- Widen category to include party rooms + raise max_players for big tables
alter table public.rooms drop constraint if exists rooms_category_check;
alter table public.rooms add constraint rooms_category_check check (category in ('game', 'casual', 'party'));
alter table public.rooms drop constraint if exists rooms_max_players_check;
alter table public.rooms add constraint rooms_max_players_check check (max_players between 2 and 12);

alter table public.rooms add column if not exists skill_level text;
alter table public.rooms add column if not exists game_type text;
alter table public.rooms add column if not exists game_settings jsonb not null default '{"auto_mute": true}'::jsonb;

create index if not exists rooms_skill_level_idx on public.rooms (skill_level) where skill_level is not null;
create index if not exists rooms_game_type_idx on public.rooms (game_type) where game_type is not null;

-- ── 2. game_sessions ─────────────────────────────────────────────────
-- One active session per room (enforced by unique index on room_id
-- where the row is "current" — we simply keep max one row per room via API logic).
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_type text not null,
  phase text not null default 'playing',      -- playing | finished
  state jsonb not null default '{}'::jsonb,   -- engine state (roles/cards/timers)
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_sessions_room on public.game_sessions (room_id);

alter table public.game_sessions enable row level security;

drop policy if exists game_sessions_anon_select on public.game_sessions;
create policy game_sessions_anon_select on public.game_sessions
  for select to anon, authenticated using (true);
drop policy if exists game_sessions_anon_insert on public.game_sessions;
create policy game_sessions_anon_insert on public.game_sessions
  for insert to anon, authenticated with check (true);
drop policy if exists game_sessions_anon_update on public.game_sessions
;
create policy game_sessions_anon_update on public.game_sessions
  for update to anon, authenticated using (true) with check (true);
drop policy if exists game_sessions_anon_delete on public.game_sessions;
create policy game_sessions_anon_delete on public.game_sessions
  for delete to anon, authenticated using (true);

-- ── 3. Ghost-room cleanup (one-time) ─────────────────────────────────
-- Close active rooms that have no members and were created > 10 min ago
update public.rooms r
set is_active = false, closed_at = now()
where r.is_active = true
  and r.closed_at is null
  and r.created_at < now() - interval '10 minutes'
  and not exists (select 1 from public.room_members m where m.room_id = r.id);
