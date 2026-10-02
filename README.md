# 🏎️ SPEC DEAL

Telegram-бот — экономический симулятор автодилера, гаража, тюнинга, аукционов и гонок. Написан на Next.js 16 + grammY + Supabase, деплоится на Vercel через webhook.

## Стек

| Слой | Технология |
|------|-----------|
| Web framework | Next.js 16 (App Router, TypeScript) |
| Bot framework | grammY 1.46 |
| Database | Supabase (Postgres + RLS) |
| ORM client | `@supabase/supabase-js` (без Prisma) |
| Hosting | Vercel (serverless webhook) |
| Source | GitHub → автодеплой в Vercel |

## Структура

```
src/
├── app/
│   ├── api/telegram/route.ts   # POST endpoint для Telegram webhook
│   ├── page.tsx                # Лендинг (health-check)
│   ├── layout.tsx
│   └── globals.css
├── config/
│   └── env.ts                  # Валидация env-переменных
├── lib/
│   ├── supabase.ts             # Supabase client + типы
│   └── bot/
│       ├── index.ts            # bot singleton (grammY)
│       ├── commands/
│       │   ├── start.ts        # /start — регистрация + главное меню
│       │   └── profile.ts     # /profile — карточка игрока
│       ├── callbacks/
│       │   └── index.ts        # Роутер inline-кнопок
│       └── menus/
│           └── main.ts         # Inline-клавиатура главного меню
├── components/ui/              # shadcn/ui (на будущее — админка)
└── hooks/

supabase/
└── migrations/
    └── 0001_init_users.sql     # Создание таблицы users + RLS

scripts/
└── setup-webhook.ts            # Привязка webhook URL к Telegram
```

## Локальная разработка

```bash
# 1. Установить зависимости
bun install

# 2. Создать .env.local (см. ниже)

# 3. Запустить dev server
bun run dev
# → http://localhost:3000
# → POST /api/telegram — webhook endpoint
```

## Переменные окружения

Скопировать в `.env.local` (локально) или в Vercel → Project Settings → Environment Variables (прод):

```env
TELEGRAM_BOT_TOKEN=8607381166:AAE...           # от @BotFather
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # anon JWT, безопасно публиковать
```

Опционально:
```env
TELEGRAM_WEBHOOK_SECRET=...                   # для верификации webhook-запросов
NEXT_PUBLIC_APP_BASE_URL=https://specdeal.vercel.app
```

## Развёртывание

### 1. Supabase — создать таблицу `users`

В Supabase Dashboard → SQL Editor → New query — выполнить содержимое `supabase/migrations/0001_init_users.sql`. Создаст таблицу `users` с RLS-политиками и триггером на `updated_at`.

### 2. Vercel — подключить GitHub-репо

- Vercel → New Project → Import `stasaleks481-code/SpecDeal`
- Framework: Next.js (auto-detected)
- Environment Variables → добавить три переменные (см. выше)
- Deploy

### 3. Telegram — привязать webhook

После первого деплоя Vercel даст URL вида `https://specdeal.vercel.app`. Привязать webhook:

```bash
WEBHOOK_URL=https://specdeal.vercel.app \
  TELEGRAM_BOT_TOKEN=... \
  bun run scripts/setup-webhook.ts
```

Или вручную:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://specdeal.vercel.app/api/telegram"
```

### 4. Проверить

В Telegram найди бота, нажми `/start` — должно прийти главное меню.

## Команды бота

| Команда | Описание |
|---------|---------|
| `/start` | Регистрация + главное меню |
| `/profile` | Карточка профиля игрока |
| `/help` | Список команд |

## Roadmap

- [x] MVP: `/start` + главное меню + профиль
- [ ] Гараж: список авто, активная машина, слоты
- [ ] Поиск авто: Свалка / Подборщик / Салон / Аукцион
- [ ] Мастерская: ремонт узлов (Кузов/Двигатель/Подвеска/Салон), Stage 1/2/3, Engine Swap
- [ ] Авторынок: рулетка гос. номеров, продажа NPC, игровой аукцион
- [ ] Банк: депозиты, кредиты
- [ ] Гонки: PvP-дрэг, дрифт, кольцо
- [ ] Кейсы: 4 типа с разной механикой

## Безопасность

- `TELEGRAM_BOT_TOKEN` — только в env vars, **никогда** в коде
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — безопасно публиковать (защищён RLS)
- `service_role` key Supabase — **не использовать** в коде бота (только в админ-скриптах)
- При утечке токенов — немедленно ротейтнуть через @BotFather / Supabase Dashboard / GitHub Settings
