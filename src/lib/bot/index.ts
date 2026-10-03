import { Bot } from 'grammy'
import { env } from '@/config/env'
import { handleStart } from '@/lib/bot/commands/start'
import { handleProfile } from '@/lib/bot/commands/profile'
import { routeText, ROUTES } from '@/lib/bot/callbacks'

/**
 * Singleton bot instance.
 * In webhook mode, grammY does not auto-fetch bot info — we call
 * bot.init() once via ensureBotReady() in the webhook route.
 */
export const bot = new Bot(env.telegramBotToken, {
  client: { baseFetchConfig: { compress: true } },
})

let initPromise: Promise<void> | null = null

export function ensureBotReady(): Promise<void> {
  if (!initPromise) {
    initPromise = bot.init()
  }
  return initPromise
}

// ─── Slash commands ──────────────────────────────────────────────────
bot.command('start', handleStart)
bot.command('profile', handleProfile)
bot.command('help', async (ctx) => {
  await ctx.reply(
    [
      '🆘 <b>Помощь по SPEC DEAL</b>',
      '',
      '<b>Главное меню</b> — внизу экрана, всегда доступно.',
      'Жми на кнопки: Гараж, Автосалоны, Мастерская, и т.д.',
      '',
      '<b>Слэш-команды:</b>',
      '<code>/start</code>    — главное меню + регистрация',
      '<code>/profile</code> — карточка профиля',
      '<code>/help</code>    — эта подсказка',
      '',
      '<b>Текстовые команды</b> (отправляй в чат):',
      '<code>купить <ID></code>           — купить машину',
      '<code>сел <ID></code>              — сделать машину активной',
      '<code>продать <ID></code>          — продать машину NPC',
      '<code>инфо <ID></code>             — детали машины',
      '<code>ремонт всё <ID></code>       — полный ремонт',
      '<code>стейдж <ID></code>          — апгрейд Stage',
      '<code>крутить</code>              — крутка номеров',
      '<code>дрэг <ставка></code>         — гонка vs NPC',
      '<code>депозит <сумма></code>       — положить в банк',
    ].join('\n'),
    { parse_mode: 'HTML' }
  )
})

// ─── Reply-keyboard button routes ────────────────────────────────────
// Each button on the persistent keyboard sends its label as text.
bot.hears(Object.values(ROUTES), routeText)

// ─── Free-text commands (buy/sell/repair/etc.) ───────────────────────
bot.on('message:text', routeText)

// ─── Callback queries (inline buttons from confirm dialogs) ────────
bot.on('callback_query', async (ctx) => {
  await ctx.answerCallbackQuery()
})

// ─── Error handler ───────────────────────────────────────────────────
bot.catch((err) => {
  console.error('[bot] unhandled error:', err.error)
})
