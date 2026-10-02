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
 * In webhook mode, grammY does not auto-fetch bot info (no getMe on every
 * request — that would be wasteful). We pass `botInfo` with just the `id`
 * derived from the token so the bot can answer inline queries and parse
 * commands like `/start@BotName` without an extra API call.
 */
const botId = Number(env.telegramBotToken.split(':')[0])

export const bot = new Bot(env.telegramBotToken, {
  client: { baseFetchConfig: { compress: true } },
  botInfo: {
    id: botId,
    is_bot: true,
    first_name: 'SpecDeal',
    username: 'specdeal_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },
})

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

// Export for type narrowing in API route
export type BotContext = typeof bot.ctx
