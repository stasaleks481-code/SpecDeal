-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SPEC DEAL — Cars Catalog Seed Data
-- 60 cars across 6 tiers (10 per tier)
-- Run after 0002_full_game_schema.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.cars_catalog (tier, brand, model, year, base_price, power_hp, weight_kg, layout, engine, is_jdm) values
-- ━━ Tier 1: Утиль и Автохлам ($1,000 – $8,000) ━━━━━━━━━━━━━━━━━━━━━━
(1, 'ВАЗ',        '2106 «Шестерка»',           1985,  3000,   75,  1045, 'RWD', '1.5L I4 NA', false),
(1, 'ВАЗ',        '2107 «Семерка»',            1995,  4500,   72,  1060, 'RWD', '1.5L I4 NA', false),
(1, 'ГАЗ',        '24 «Волга»',                1980,  6000,   95,  1460, 'RWD', '2.4L I4 NA', false),
(1, 'ИЖ',         '2715 «Каблук»',              1982,  2000,   70,  1080, 'RWD', '1.5L I4 NA', false),
(1, 'Москвич',    '412',                       1978,  2500,   75,  1050, 'RWD', '1.5L I4 NA', false),
(1, 'Daewoo',     'Nexia',                     2000,  4500,   80,  1025, 'FWD', '1.5L I4 NA', false),
(1, 'Lada',       'Samara (2109)',             1992,  5000,   78,  1000, 'FWD', '1.5L I4 NA', false),
(1, 'Ford',       'Sierra',                    1987,  6000,   90,  1180, 'RWD', '1.6L I4 NA', false),
(1, 'Opel',       'Kadett',                    1985,  4000,   75,  1000, 'FWD', '1.6L I4 NA', false),
(1, 'Honda',      'Civic (ушатанная)',         1992,  7000,  110,   970, 'FWD', '1.6L I4 NA', true),

-- ━━ Tier 2: Городской Сток и Классика ($8,000 – $25,000) ━━━━━━━━━━━
(2, 'Lada',       'Priora',                    2010, 18000,  106,  1088, 'FWD', '1.6L I4 NA', false),
(2, 'Lada',       'Vesta Sport',               2020, 22000,  140,  1180, 'FWD', '1.8L I4 NA', false),
(2, 'BMW',        'E30 (320i)',                1986, 20000,  125,  1080, 'RWD', '2.0L I6 NA', false),
(2, 'Mercedes',   'W124 (E200)',               1990, 22000,  136,  1370, 'RWD', '2.0L I4 NA', false),
(2, 'Audi',       '80 «Бочка»',                1989, 14000,  115,  1100, 'FWD', '2.0L I4 NA', false),
(2, 'Toyota',     'Mark II (GX90)',            1992, 20000,  160,  1290, 'RWD', '2.0L I6 NA', true),
(2, 'Nissan',     'Silvia (S13, Сток)',        1990, 18000,  140,  1240, 'RWD', '1.8L I4 NA', true),
(2, 'Volkswagen', 'Golf GTI III',              1995, 16000,  115,  1070, 'FWD', '2.0L I4 NA', false),
(2, 'Subaru',     'Impreza (1998, 2.0 Атмо)',  1998, 20000,  155,  1240, 'AWD', '2.0L H4 NA', false),
(2, 'Mazda',      'MX-5 Miata (NA)',           1990, 22000,  116,   940, 'RWD', '1.6L I4 NA', true),

-- ━━ Tier 3: Уличный Тюнинг и JDM Легенды ($25,000 – $75,000) ━━━━━━
(3, 'Toyota',     'Mark II (JZX100 Tourer V)', 1996, 55000,  280,  1350, 'RWD', '2.5L I6 Turbo', true),
(3, 'Nissan',     'Silvia S15 Spec-R',         2000, 65000,  250,  1240, 'RWD', '2.0L I4 Turbo (SR20DET)', true),
(3, 'Nissan',     'Skyline R34 GT-T',          1998, 70000,  280,  1420, 'RWD', '2.5L I6 Turbo (RB25DET)', true),
(3, 'Subaru',     'WRX STI (Blobeye)',         2004, 45000,  280,  1470, 'AWD', '2.0L H4 Turbo (EJ207)', true),
(3, 'Mitsubishi', 'Lancer Evolution IX',       2006, 60000,  280,  1450, 'AWD', '2.0L I4 Turbo (4G63T)', true),
(3, 'BMW',        'E36 M3',                    1995, 50000,  286,  1460, 'RWD', '3.0L I6 NA (S50B30)', false),
(3, 'BMW',        'E39 540i',                  1997, 45000,  286,  1670, 'RWD', '4.4L V8 NA (M62)', false),
(3, 'Mercedes',   'W210 E55 AMG',              1998, 50000,  354,  1670, 'RWD', '5.4L V8 NA', false),
(3, 'Honda',      'S2000',                     2000, 60000,  240,  1270, 'RWD', '2.0L I4 NA (F20C, 9000 rpm!)', true),
(3, 'Toyota',     'Supra A80 (Non-Turbo)',     1994, 70000,  225,  1560, 'RWD', '3.0L I6 NA (2JZ-GE)', true),

-- ━━ Tier 4: Заряженный Премиум и Спорткары ($75,000 – $200,000) ━━━
(4, 'BMW',        'M5 E60 (V10)',              2005, 150000, 507,  1755, 'RWD', '5.0L V10 NA (S85)', false),
(4, 'Mercedes',   'C63 AMG (W204)',            2010, 120000, 457,  1730, 'RWD', '6.2L V8 NA (M156)', false),
(4, 'Audi',       'RS6 C7 Avant',              2013, 140000, 560,  2000, 'AWD', '4.0L V8 TwinTurbo', false),
(4, 'Nissan',     'GT-R R35 (Early)',          2009, 160000, 485,  1740, 'AWD', '3.8L V6 TwinTurbo (VR38DETT)', true),
(4, 'Porsche',    '911 Carrera (997)',         2006, 130000, 325,  1450, 'RWD', '3.6L Flat-6 NA', false),
(4, 'Chevrolet',  'Corvette C6 Z06',           2007, 130000, 505,  1418, 'RWD', '7.0L V8 NA (LS7)', false),
(4, 'Dodge',      'Challenger SRT Hellcat',    2015, 140000, 717,  2000, 'RWD', '6.2L V8 Supercharged', false),
(4, 'Toyota',     'Supra A80 Twin-Turbo',      1994, 175000, 326,  1560, 'RWD', '3.0L I6 TwinTurbo (2JZ-GTE)', true),
(4, 'Lexus',      'LFA (Конфиг Завода)',       2010, 200000, 552,  1480, 'RWD', '4.8L V10 NA (1LR-GUE)', false),
(4, 'BMW',        'M4 F82',                    2015, 110000, 431,  1495, 'RWD', '3.0L I6 TwinTurbo (S55B30)', false),

-- ━━ Tier 5: Суперкары и Экзотика ($200,000 – $600,000) ━━━━━━━━━━━━
(5, 'Lamborghini', 'Huracan LP610-4',         2014, 350000, 610,  1422, 'AWD', '5.2L V10 NA', false),
(5, 'Ferrari',     '458 Italia',               2010, 380000, 570,  1380, 'RWD', '4.5L V8 NA', false),
(5, 'Porsche',     '911 GT3 RS (991)',         2015, 350000, 500,  1370, 'RWD', '4.0L Flat-6 NA', false),
(5, 'McLaren',     '720S',                     2017, 400000, 720,  1283, 'RWD', '4.0L V8 TwinTurbo (M840T)', false),
(5, 'Aston Martin','DBS',                      2008, 280000, 510,  1695, 'RWD', '5.9L V12 NA', false),
(5, 'Ford',        'GT (2017)',                2017, 500000, 647,  1385, 'RWD', '3.5L V6 TwinTurbo (EcoBoost)', false),
(5, 'Mercedes',    'AMG GT R',                  2018, 280000, 585,  1555, 'RWD', '4.0L V8 TwinTurbo (M178)', false),
(5, 'Audi',        'R8 V10 Plus',              2016, 250000, 610,  1454, 'AWD', '5.2L V10 NA', false),
(5, 'Lamborghini', 'Murcielago LP640',        2006, 450000, 640,  1665, 'AWD', '6.5L V12 NA', false),
(5, 'Ferrari',     'F40',                      1987, 600000, 471,  1100, 'RWD', '2.9L V8 TwinTurbo (F120A)', false),

-- ━━ Tier 6: Гиперкары и Легенды Автоспорта ($600,000 – $3,000,000+) ━
(6, 'Bugatti',     'Veyron Super Sport',       2010, 2500000, 1200, 1838, 'AWD', '8.0L W16 QuadTurbo', false),
(6, 'Koenigsegg',  'Agera R',                  2013, 2200000, 1140, 1295, 'RWD', '5.0L V8 TwinTurbo', false),
(6, 'Pagani',      'Zonda R',                  2009, 1800000, 740,  1070, 'RWD', '6.0L V12 NA (AMG)', false),
(6, 'Porsche',     '918 Spyder',               2014, 1100000, 887,  1675, 'AWD', '4.6L V8 NA + Hybrid', false),
(6, 'McLaren',     'P1',                       2013, 1500000, 903,  1547, 'RWD', '3.8L V8 TwinTurbo + Hybrid', false),
(6, 'Ferrari',     'LaFerrari',                2013, 1700000, 963,  1255, 'RWD', '6.3L V12 NA + Hybrid', false),
(6, 'Nissan',      'Skyline GT-R R34 Z-Tune',  2002, 800000, 493,  1540, 'AWD', '2.8L I6 TwinTurbo (RB26DETT)', true),
(6, 'Subaru',      'Impreza 22B STI',          1998, 600000,  280,  1270, 'AWD', '2.2L H4 Turbo (EJ22G)', true),
(6, 'McLaren',     'F1',                       1995, 2500000, 627,  1138, 'RWD', '6.1L V12 NA (BMW S70/2)', false),
(6, 'Bugatti',     'Chiron',                   2016, 3000000, 1500, 1995, 'AWD', '8.0L W16 QuadTurbo', false)
on conflict (brand, model, year) do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Pre-populate state dealerships with random inventory
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.dealership_inventory (dealership_id, catalog_id, condition, price, stock, restock_at)
select
  d.id as dealership_id,
  c.id as catalog_id,
  -- Junkyard: 5-30% condition; state salons: 60-95%
  case
    when d.name like '%Свалка%' then floor(random() * 26 + 5)::int
    else floor(random() * 36 + 60)::int
  end as condition,
  -- Price: base_price * (condition/100) * 0.8 (junkyard) or 1.0 (state)
  case
    when d.name like '%Свалка%' then c.base_price * (case when floor(random() * 26 + 5)::int = 0 then 0.05 else floor(random() * 26 + 5)::int end / 100.0) * 0.8
    else c.base_price * (1.0 + (random() - 0.5) * 0.1)  -- ±5% random
  end as price,
  case
    when d.name like '%Свалка%' then floor(random() * 3 + 1)::int  -- 1-3 in stock
    else floor(random() * 2 + 1)::int  -- 1-2 in stock
  end as stock,
  now() + interval '6 hours' + (random() * interval '12 hours')
from public.dealerships d
cross join public.cars_catalog c
where
  case d.name
    when '🚧 Свалка "Автохлам"'      then c.tier = 1
    when '🏛 Гос. салон "Бюджет"'    then c.tier in (1, 2)
    when '🏛 Гос. салон "Народный"'  then c.tier in (2, 3)
    when '🏛 Гос. салон "Премиум"'  then c.tier in (4, 5, 6)
  end
  and random() < 0.6  -- 60% of eligible cars are in stock
on conflict (dealership_id, catalog_id) do nothing;
