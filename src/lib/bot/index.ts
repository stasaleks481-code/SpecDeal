import { Bot } from 'grammy'
import { env } from '@/config/env'
import { handleStart } from '@/lib/bot/commands/start'
import { handleProfile } from '@/lib/bot/commands/profile'
import { handleCallback } from '@/lib/bot/callbacks'

/**
 * Singleton bot instance.
 *
 * Created once per serverless cold start; reused across webhook invocations.
 * grammY's `webhookCallback` adapts this to a standard Request/Response pair
 * — see `src/app/api/telegram/route.ts`.
 *
 * We don't pass `botInfo` to the constructor because it requires the full
 * `UserFromGetMe` shape which we don't know without calling getMe. Instead,
 * we call `bot.init()` once before handling the first update — grammY
 * memoises the getMe promise so subsequent calls are free.
 */
export const bot = new Bot(env.telegramBotToken, {
  client: { baseFetchConfig: { compress: true } },
})

/**
 * Lazily-initialised init promise. grammY's `bot.init()` is idempotent —
 * calling it multiple times returns the same in-flight promise — so we just
 * expose a single promise for the webhook route to await.
 */
let initPromise: Promise<void> | null = null

export function ensureBotReady(): Promise<void> {
  if (!initPromise) {
    initPromise = bot.init()
  }
  return initPromise
}

// ─── Command handlers ────────────────────────────────────────────────
bot.command('start', handleStart)
bot.command('profile', handleProfile)
bot.command('help', async (ctx) => {
  await ctx.reply(
    [
      '🆘 <b>Команды бота:</b>',
      '',
      '<code>/start</code> — главное меню',
      '<code>/profile</code> — карточка профиля',
      '<code>/help</code> — эта подсказка',
      '',
      'Либо просто жми на inline-кнопки под сообщениями.',
    ].join('\n'),
    { parse_mode: 'HTML' }
  )
})

// ─── Callback router ─────────────────────────────────────────────────
bot.on('callback_query', handleCallback)

// ─── Catch-all for unexpected errors ─────────────────────────────────
bot.catch((err) => {
  console.error('[bot] unhandled error:', err.error)
})
