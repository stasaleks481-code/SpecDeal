-- ════════════════════════════════════════════════════════════════════
-- VoiceDeck migration 0004
-- 1. users.is_banned — admin moderation
-- 2. support_tickets — in-app support (bugs / ideas / questions)
-- 3. announcements — broadcast banners shown in the app
-- 4. app_config — server-side key/value (admin password hash etc.)
-- 5. One-time presence sweep (fix "stuck online" ghost statuses)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. users.is_banned ───────────────────────────────────────────────
alter table public.users add column if not exists is_banned boolean not null default false;

-- ── 2. support_tickets ───────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.users(id) on delete cascade,
  type text not null default 'question',      -- bug | idea | question
  subject text not null,
  message text not null,
  status text not null default 'new',         -- new | in_progress | resolved
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_type_check check (type in ('bug', 'idea', 'question')),
  constraint support_tickets_status_check check (status in ('new', 'in_progress', 'resolved'))
);

create index if not exists idx_support_tickets_user on public.support_tickets (user_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, created_at desc);

-- ── 3. announcements ─────────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'info',          -- info | warning | update
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_active on public.announcements (is_active, created_at desc);

-- ── 4. app_config ────────────────────────────────────────────────────
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ── RLS: permissive (same model as the rest of the schema —
--    authorization is enforced by the Next.js API layer) ─────────────
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_anon_select on public.support_tickets;
create policy support_tickets_anon_select on public.support_tickets
  for select to anon, authenticated using (true);
drop policy if exists support_tickets_anon_insert on public.support_tickets;
create policy support_tickets_anon_insert on public.support_tickets
  for insert to anon, authenticated with check (true);
drop policy if exists support_tickets_anon_update on public.support_tickets;
create policy support_tickets_anon_update on public.support_tickets
  for update to anon, authenticated using (true) with check (true);
drop policy if exists support_tickets_anon_delete on public.support_tickets;
create policy support_tickets_anon_delete on public.support_tickets
  for delete to anon, authenticated using (true);

alter table public.announcements enable row level security;
drop policy if exists announcements_anon_select on public.announcements;
create policy announcements_anon_select on public.announcements
  for select to anon, authenticated using (true);
drop policy if exists announcements_anon_insert on public.announcements;
create policy announcements_anon_insert on public.announcements
  for insert to anon, authenticated with check (true);
drop policy if exists announcements_anon_update on public.announcements;
create policy announcements_anon_update on public.announcements
  for update to anon, authenticated using (true) with check (true);
drop policy if exists announcements_anon_delete on public.announcements;
create policy announcements_anon_delete on public.announcements
  for delete to anon, authenticated using (true);

alter table public.app_config enable row level security;
drop policy if exists app_config_anon_select on public.app_config;
create policy app_config_anon_select on public.app_config
  for select to anon, authenticated using (true);
drop policy if exists app_config_anon_insert on public.app_config;
create policy app_config_anon_insert on public.app_config
  for insert to anon, authenticated with check (true);
drop policy if exists app_config_anon_update on public.app_config;
create policy app_config_anon_update on public.app_config
  for update to anon, authenticated using (true) with check (true);
drop policy if exists app_config_anon_delete on public.app_config;
create policy app_config_anon_delete on public.app_config
  for delete to anon, authenticated using (true);

-- ── 5. One-time presence sweep ───────────────────────────────────────
-- Fix "stuck online": from now on, online status is derived from
-- last_seen_at freshness (90 s window) — reset all current flags.
update public.users set is_online = false where is_online = true;
