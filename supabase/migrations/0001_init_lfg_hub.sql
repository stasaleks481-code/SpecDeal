-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- LFG VOICE HUB — Telegram Mini App database schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create extension if not exists "pgcrypto";

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- USERS — base profile (auto-created on first TMA open via Telegram initData)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.users (
  id              bigint       primary key,                  -- Telegram user ID
  username        text,                                      -- @handle (without @)
  first_name      text         not null,
  last_name       text,
  photo_url       text,                                      -- Telegram avatar URL
  language_code   text,

  -- Steam binding (optional)
  steam_id        text         unique,
  steam_data      jsonb,                                     -- {avatar, personaname, games_count, ...}
  steam_linked_at timestamptz,

  -- Trust / reputation
  trust_score     integer      not null default 0,           -- calculated from reviews
  reviews_count   integer      not null default 0,
  matches_count   integer      not null default 0,          -- completed LFG matches

  -- UI preferences
  theme_color     text         not null default 'cyan',     -- cyan | pink | green | amber

  -- Online status (real-time updated)
  is_online       boolean      not null default false,
  last_seen_at    timestamptz  not null default now(),

  -- Badges (JSON array of badge codes: 'verified', 'captain', 'adequate', etc.)
  badges          jsonb        not null default '[]'::jsonb,

  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create index if not exists idx_users_steam_id  on public.users (steam_id) where steam_id is not null;
create index if not exists idx_users_online     on public.users (is_online) where is_online = true;
create index if not exists idx_users_username   on public.users (username) where username is not null;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FRIENDS — friend requests + accepted friendships
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.friends (
  id              uuid         primary key default gen_random_uuid(),
  user_id_1       bigint       not null references public.users(id) on delete cascade,
  user_id_2       bigint       not null references public.users(id) on delete cascade,
  status          text         not null check (status in ('pending', 'accepted', 'blocked')) default 'pending',
  -- user_id_1 sent request to user_id_2 (requester → target)
  created_at      timestamptz  not null default now(),
  accepted_at     timestamptz,
  unique (user_id_1, user_id_2),
  check (user_id_1 <> user_id_2)
);

create index if not exists idx_friends_user1   on public.friends (user_id_1, status);
create index if not exists idx_friends_user2   on public.friends (user_id_2, status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROOMS — LFG lobbies + voice/chill rooms
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.rooms (
  id              uuid         primary key default gen_random_uuid(),
  host_id         bigint       not null references public.users(id) on delete cascade,
  category        text         not null check (category in ('game', 'casual')),

  -- Game-specific (category='game')
  game_name       text,                                      -- 'CS2', 'Dota 2', 'Roblox', etc.
  game_format     text,                                      -- '2x2', '3x3', '5x5', 'duo', 'full'
  play_style      text,                                      -- 'ranked', 'chill', 'fun'

  -- Casual-specific (category='casual')
  topic_tags      text[]      not null default '{}',        -- ['Поговорить по душам', 'Кино', 'Музыка']

  -- Common
  title           text         not null,
  description     text,
  max_players     smallint     not null check (max_players between 2 and 5) default 5,
  is_private      boolean      not null default false,
  is_active       boolean      not null default true,
  voice_enabled   boolean      not null default false,       -- stub flag (no real voice yet)
  created_at      timestamptz  not null default now(),
  closed_at       timestamptz
);

create index if not exists idx_rooms_active      on public.rooms (category, is_active) where is_active = true;
create index if not exists idx_rooms_host         on public.rooms (host_id);
create index if not exists idx_rooms_game        on public.rooms (game_name) where category = 'game' and game_name is not null;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROOM MEMBERS — who's in which room
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.room_members (
  room_id         uuid         not null references public.rooms(id) on delete cascade,
  user_id         bigint       not null references public.users(id) on delete cascade,
  joined_at       timestamptz  not null default now(),
  is_ready        boolean      not null default false,
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_user   on public.room_members (user_id);
create index if not exists idx_room_members_room   on public.room_members (room_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROOM CHAT — messages inside a room
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.room_messages (
  id              bigserial    primary key,
  room_id         uuid         not null references public.rooms(id) on delete cascade,
  sender_id       bigint       not null references public.users(id) on delete cascade,
  content         text         not null,
  created_at      timestamptz  not null default now()
);

create index if not exists idx_room_messages_room   on public.room_messages (room_id, created_at desc);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- DIRECT MESSAGES — 1-on-1 chat
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.direct_messages (
  id              bigserial    primary key,
  sender_id       bigint       not null references public.users(id) on delete cascade,
  receiver_id     bigint       not null references public.users(id) on delete cascade,
  content         text         not null,
  read_at         timestamptz,                                -- null = unread
  created_at      timestamptz  not null default now()
);

create index if not exists idx_dm_sender_time       on public.direct_messages (sender_id, created_at desc);
create index if not exists idx_dm_receiver_time     on public.direct_messages (receiver_id, created_at desc);
create index if not exists idx_dm_pair              on public.direct_messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEWS — post-match/post-conversation feedback
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table public.reviews (
  id              uuid         primary key default gen_random_uuid(),
  from_user_id    bigint       not null references public.users(id) on delete cascade,
  to_user_id      bigint       not null references public.users(id) on delete cascade,
  rating_type     text         not null check (rating_type in ('friendly', 'good_aim', 'captain', 'toxic', 'leaver', 'good_chat')),
  comment         text,
  room_id         uuid         references public.rooms(id) on delete set null,
  created_at      timestamptz  not null default now(),
  unique (from_user_id, to_user_id, room_id),
  check (from_user_id <> to_user_id)
);

create index if not exists idx_reviews_to_user   on public.reviews (to_user_id, created_at desc);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Realtime: enable for rooms/DMs/room_members (online status)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.direct_messages;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROW LEVEL SECURITY — open (TMA logic runs server-side, validates initData)
-- For production: tighten with policies that check current_user via JWT.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
do $$
declare t text;
begin
  foreach t in array ARRAY[
    'users', 'friends', 'rooms', 'room_members', 'room_messages',
    'direct_messages', 'reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_select', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_anon_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_insert', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)', t || '_anon_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_update', t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', t || '_anon_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_delete', t);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (true)', t || '_anon_delete', t);
  end loop;
end $$;

-- Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Comments
comment on table public.users is 'Telegram Mini App users (LFG Voice Hub)';
comment on table public.friends is 'Friend requests + accepted friendships';
comment on table public.rooms is 'LFG lobbies (game category) + chill rooms (casual)';
comment on table public.room_members is 'Members of a room (2-5 per room)';
comment on table public.direct_messages is '1-on-1 chat messages';
comment on table public.reviews is 'Post-match feedback (trust score basis)';
