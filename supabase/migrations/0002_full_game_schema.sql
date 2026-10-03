-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SPEC DEAL — Full game schema (Phase 2)
-- Run this in Supabase SQL Editor after 0001_init_users.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CARS CATALOG — 60 models across 6 tiers
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.cars_catalog (
  id              serial       primary key,
  tier            smallint     not null check (tier between 1 and 6),
  brand           text         not null,
  model           text         not null,
  year            smallint     not null,
  base_price      numeric(12, 2) not null,
  power_hp        integer      not null,                -- Л.С. сток
  weight_kg       integer      not null,
  layout          text         not null,                -- FWD / RWD / AWD
  engine          text         not null,                -- "2.0L I4 Turbo" / "5.7L V8 NA" / etc
  is_jdm          boolean      not null default false,
  image_url       text,
  created_at      timestamptz  not null default now(),
  unique (brand, model, year)
);

create index if not exists idx_cars_catalog_tier on public.cars_catalog (tier);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- USER CARS — actual cars owned by players
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.user_cars (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  catalog_id      integer      not null references public.cars_catalog(id),

  -- Current state
  body_cond         smallint   not null default 0 check (body_cond    between 0 and 100),
  engine_cond       smallint   not null default 0 check (engine_cond  between 0 and 100),
  suspension_cond   smallint   not null default 0 check (suspension_cond between 0 and 100),
  interior_cond     smallint   not null default 0 check (interior_cond between 0 and 100),

  -- Tuning
  stage_level       smallint   not null default 0 check (stage_level between 0 and 3),
  engine_swap       text,                                -- "2JZ-GTE", "RB26DETT", etc (null = no swap)
  has_lsd           boolean    not null default false,
  has_welded_diff   boolean    not null default false,

  -- Identity & status
  plate_id          uuid,                                 -- license_plate.id (if assigned)
  nickname          text,                                 -- player-set nickname
  is_active         boolean    not null default false,   -- active car for races
  is_listed         boolean    not null default false,   -- on the P2P market
  purchase_price    numeric(12, 2) not null,
  purchase_source   text       not null,                  -- 'dealership_state' / 'dealership_private' / 'market' / 'case' / 'junkyard'
  mileage_km        integer    not null default 0,

  -- Housekeeping
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_user_cars_user       on public.user_cars (user_id);
create index if not exists idx_user_cars_active     on public.user_cars (user_id) where is_active;
create index if not exists idx_user_cars_listed     on public.user_cars (user_id) where is_listed;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- LICENSE PLATES — obtained via gacha roulette
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.license_plates (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  car_id          uuid         references public.user_cars(id) on delete set null,
  plate_text      text         not null,                 -- "А777АА"
  region          text         not null,                 -- "777"
  rarity          text         not null check (rarity in ('common', 'mirror', 'hundred', 'triple', 'elite', 'legendary')),
  price_modifier  numeric(4, 2) not null,                -- 1.0, 1.15, 1.25, 1.50, 1.80, 2.20
  is_assigned     boolean      not null default false,    -- true if attached to a car
  is_listed       boolean      not null default false,    -- on the plate market
  listed_price    numeric(12, 2),
  created_at      timestamptz  not null default now()
);

create index if not exists idx_plates_user   on public.license_plates (user_id);
create index if not exists idx_plates_rarity on public.license_plates (rarity);
create index if not exists idx_plates_listed on public.license_plates (user_id) where is_listed;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- DEALERSHIPS — state (NPC) + private (player-owned)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.dealerships (
  id              serial       primary key,
  type            text         not null check (type in ('state', 'private')),
  name            text         not null,
  owner_id        bigint       references public.users(telegram_id) on delete set null, -- null for state, user_id for private
  tier_min        smallint     not null default 1 check (tier_min between 1 and 6),
  tier_max        smallint     not null default 6 check (tier_max between 1 and 6),
  markup_pct      numeric(5, 2) not null default 0,   -- state: 0% (MSRP); private: 0..50%
  fee_pct         numeric(5, 2) not null default 0,   -- listing fee (private)
  created_at      timestamptz  not null default now()
);

-- Pre-seed state dealerships (junkyard + 3 state salons by tier)
insert into public.dealerships (type, name, owner_id, tier_min, tier_max, markup_pct, fee_pct)
values
  ('state', '🚧 Свалка "Автохлам"',        null, 1, 1, 0, 0),
  ('state', '🏛 Гос. салон "Бюджет"',      null, 1, 2, 0, 0),
  ('state', '🏛 Гос. салон "Народный"',    null, 2, 3, 0, 0),
  ('state', '🏛 Гос. салон "Премиум"',    null, 4, 6, 0, 0)
on conflict do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- DEALERSHIP INVENTORY — what's currently in each state dealership
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.dealership_inventory (
  id              serial       primary key,
  dealership_id   integer      not null references public.dealerships(id) on delete cascade,
  catalog_id     integer      not null references public.cars_catalog(id),
  condition       smallint     not null default 50 check (condition between 0 and 100),
  price           numeric(12, 2) not null,                -- current asking price
  stock           integer      not null default 1,        -- how many available
  restock_at     timestamptz,                             -- when next batch arrives
  created_at      timestamptz  not null default now(),
  unique (dealership_id, catalog_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MARKET LISTINGS — P2P car market (players selling to players)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.market_listings (
  id              uuid         primary key default gen_random_uuid(),
  seller_id       bigint       not null references public.users(telegram_id) on delete cascade,
  car_id          uuid         not null references public.user_cars(id) on delete cascade,
  asking_price    numeric(12, 2) not null,
  listed_at       timestamptz  not null default now(),
  expires_at     timestamptz  not null default (now() + interval '7 days'),
  sold_to         bigint       references public.users(telegram_id),
  sold_at         timestamptz,
  sold_price      numeric(12, 2)
);

create index if not exists idx_market_active   on public.market_listings (listed_at) where sold_at is null;
create index if not exists idx_market_seller   on public.market_listings (seller_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BANK — deposits & loans
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.bank_deposits (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  amount          numeric(15, 2) not null,
  rate_daily     numeric(5, 4) not null default 0.015,   -- 1.5% per day
  last_interest_at timestamptz not null default now(),
  created_at      timestamptz  not null default now()
);

create table if not exists public.bank_loans (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  principal       numeric(15, 2) not null,
  outstanding     numeric(15, 2) not null,
  rate_daily     numeric(5, 4) not null default 0.03,    -- 3% per day
  due_at          timestamptz  not null,
  is_paid         boolean      not null default false,
  created_at      timestamptz  not null default now(),
  paid_at         timestamptz
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RACES — match history + queue
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.races (
  id              uuid         primary key default gen_random_uuid(),
  race_type       text         not null check (race_type in ('drag', 'ring', 'drift')),
  distance_m      integer      not null default 402,
  player1_id      bigint       not null references public.users(telegram_id),
  player2_id      bigint       references public.users(telegram_id),    -- null = vs NPC
  player1_car_id  uuid         not null references public.user_cars(id),
  player2_car_id  uuid         references public.user_cars(id),
  player1_perf    numeric(10, 2),
  player2_perf    numeric(10, 2),
  winner_id       bigint       not null references public.users(telegram_id),
  bet_amount      numeric(12, 2) not null default 0,
  log             jsonb,                                   -- race replay log
  created_at      timestamptz  not null default now()
);

create index if not exists idx_races_player1   on public.races (player1_id, created_at desc);
create index if not exists idx_races_player2   on public.races (player2_id, created_at desc);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ACHIEVEMENTS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.achievements (
  id              serial       primary key,
  code            text         not null unique,
  title           text         not null,
  description     text         not null,
  icon            text         not null,                -- emoji
  reward_cr       numeric(12, 2) not null default 0,
  reward_sp       integer      not null default 0,
  tier            text         not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum'))
);

create table if not exists public.user_achievements (
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  achievement_id  integer      not null references public.achievements(id) on delete cascade,
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- Pre-seed achievements
insert into public.achievements (code, title, description, icon, reward_cr, reward_sp, tier) values
  ('first_car',       'Первая тачка',         'Купи свою первую машину',                '🚗', 5000,   0, 'bronze'),
  ('first_sale',      'Первая продажа',       'Продай машину',                          '💵', 5000,   0, 'bronze'),
  ('first_win',       'Первая победа',        'Выиграй гонку',                          '🏁', 5000,   0, 'bronze'),
  ('collector_t3',    'Коллекционер T3',      'Имей 3 машины Tier 3+ одновременно',      '🏆', 25000,  5, 'silver'),
  ('tuner_stage3',    'Корчестроитель',       'Установи Stage 3 на любую машину',        '🔥', 30000, 10, 'gold'),
  ('plate_legend',    'Блатной',              'Выбей легендарный гос. номер',            '🎰', 50000, 20, 'gold'),
  ('millionaire',     'Магнат',               'Накопи $1,000,000 на балансе',            '💰', 50000, 25, 'platinum'),
  ('racer_50',        'Гонщик 50',            'Выиграй 50 гонок',                        '🏎',  100000, 30, 'platinum'),
  ('case_addict',     'Лудоман',              'Открой 100 кейсов',                       '🎲', 25000, 10, 'gold'),
  ('dealer_owner',    'Свой салон',           'Открой частный автосалон',               '🏬', 100000, 25, 'platinum')
on conflict (code) do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CASES — 4 types
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.cases (
  id              serial       primary key,
  code            text         not null unique,
  name            text         not null,
  description     text         not null,
  price_cr        numeric(12, 2),
  price_sp        integer,
  icon            text         not null
);

insert into public.cases (code, name, description, price_cr, price_sp, icon) values
  ('junk',     '📦 Утиль-Секрет',       'Случайный уставший Tier 1-2 с редким тюнингом', 10000, null, '📦'),
  ('jdm',      '🎌 JDM Power',          'Только японские авто (Tier 2-4) + шансы на swap','50000', null, '🎌'),
  ('plates',   '🎰 Блатные Номера',     'Повышенный шанс выпадения красивых номеров',    25000, null, '🎰'),
  ('major',    '💎 Кейс Мажор',         'Шанс выбить авто Tier 5-6',                     null, 50, '💎')
on conflict (code) do nothing;

create table if not exists public.case_openings (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  case_id         integer      not null references public.cases(id),
  result_type     text         not null,                -- 'car' / 'plate' / 'money' / 'nothing'
  result_data     jsonb,
  created_at      timestamptz not null default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MARKETPLACE HISTORY — for price analytics (avg price by model)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.marketplace_history (
  id              bigserial    primary key,
  catalog_id      integer      not null references public.cars_catalog(id),
  price           numeric(12, 2) not null,
  sold_at         timestamptz not null default now()
);

create index if not exists idx_market_history_catalog on public.marketplace_history (catalog_id, sold_at desc);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- DAILY TASKS — generated per user per day
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.daily_tasks (
  id              serial       primary key,
  code            text         not null,
  description     text         not null,
  target_count    integer      not null default 1,
  reward_cr       numeric(12, 2) not null default 0,
  reward_sp       integer      not null default 0,
  icon            text         not null
);

insert into public.daily_tasks (code, description, target_count, reward_cr, reward_sp, icon) values
  ('repair_3',    'Почини 3 узла на любой машине',           3, 5000,  0, '🔧'),
  ('win_3',       'Выиграй 3 гонки',                          3, 10000, 1, '🏁'),
  ('sell_1',      'Продай 1 машину с прибылью ≥ 20%',         1, 8000,  0, '💵'),
  ('spin_5',      'Крутани рулетку номеров 5 раз',            5, 3000,  0, '🎰'),
  ('open_1',      'Открой 1 кейс',                            1, 0,     2, '📦')
on conflict do nothing;

create table if not exists public.user_daily_tasks (
  id              uuid         primary key default gen_random_uuid(),
  user_id         bigint       not null references public.users(telegram_id) on delete cascade,
  task_id         integer      not null references public.daily_tasks(id),
  progress        integer      not null default 0,
  completed       boolean      not null default false,
  assigned_at     timestamptz not null default now(),
  unique (user_id, task_id, assigned_at)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS POLICIES — anon can read/write everything (game is server-side)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

do $$
declare
  t text;
  tables text[] := array[
    'cars_catalog', 'user_cars', 'license_plates', 'dealerships',
    'dealership_inventory', 'market_listings', 'bank_deposits',
    'bank_loans', 'races', 'achievements', 'user_achievements',
    'cases', 'case_openings', 'marketplace_history',
    'daily_tasks', 'user_daily_tasks'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    -- Drop & recreate policies (idempotent)
    execute format('drop policy if exists "%I_anon_select" on public.%I', t, t);
    execute format('create policy "%I_anon_select" on public.%I for select to anon, authenticated using (true)', t, t);

    execute format('drop policy if exists "%I_anon_insert" on public.%I', t, t);
    execute format('create policy "%I_anon_insert" on public.%I for insert to anon, authenticated with check (true)', t, t);

    execute format('drop policy if exists "%I_anon_update" on public.%I', t, t);
    execute format('create policy "%I_anon_update" on public.%I for update to anon, authenticated using (true) with check (true)', t, t);

    execute format('drop policy if exists "%I_anon_delete" on public.%I', t, t);
    execute format('create policy "%I_anon_delete" on public.%I for delete to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- Comments
comment on table public.cars_catalog is 'Static catalog of 60 cars across 6 tiers';
comment on table public.user_cars is 'Cars owned by players with condition, tuning, mileage';
comment on table public.license_plates is 'License plates obtained via gacha roulette';
comment on table public.dealerships is 'State (NPC) + private (player-owned) dealerships';
comment on table public.market_listings is 'P2P car marketplace listings';
comment on table public.races is 'Race history with replay logs';
comment on table public.achievements is 'Static achievement catalog (50+ in future)';
