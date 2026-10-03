import { Bot } from 'grammy'
import { env } from '@/config/env'
import { handleStart } from '@/lib/bot/commands/start'
import { handleProfile } from '@/lib/bot/commands/profile'
import { handleGarage } from '@/lib/bot/commands/garage'
import { handleDealerships } from '@/lib/bot/commands/dealerships'
import { handleWorkshop } from '@/lib/bot/commands/workshop'
import { handlePlates } from '@/lib/bot/commands/plates'
import { handleBank } from '@/lib/bot/commands/bank'
import { handleRaces } from '@/lib/bot/commands/races'
import { handleCases } from '@/lib/bot/commands/cases'
import { handleCallback } from '@/lib/bot/callbacks'
import { mainMenuKeyboard } from '@/lib/bot/menus/main'

/**
 * Singleton bot instance.
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
      `🆘 <b>Помощь</b>`,
      '',
      '<b>Главное меню</b> — внизу экрана, всегда доступно.',
      '',
      '<b>Слэш-команды:</b>',
      '<code>/start</code> — регистрация + меню',
      '<code>/profile</code> — карточка профиля',
      '<code>/help</code> — эта подсказка',
      '',
      'Все действия — через inline-кнопки под сообщениями.',
      'Писать текстом команды НЕ нужно.',
    ].join('\n'),
    { parse_mode: 'HTML' }
  )
})

// ─── Reply-keyboard buttons (label match) ────────────────────────────
bot.hears(['🚗 Гараж', '🏬 Салоны', '🔧 Сервис', '🎰 Номера', '🏦 Банк', '🏁 Гонки', '📦 Кейсы', '👤 Профиль'], async (ctx) => {
  const text = ctx.message?.text
  if (!text) return

  switch (text) {
    case '🚗 Гараж':
      await handleGarage(ctx, 0)
      break
    case '🏬 Салоны':
      await handleDealerships(ctx)
      break
    case '🔧 Сервис':
      await handleWorkshop(ctx, 0)
      break
    case '🎰 Номера':
      await handlePlates(ctx)
      break
    case '🏦 Банк':
      await handleBank(ctx)
      break
    case '🏁 Гонки':
      await handleRaces(ctx)
      break
    case '📦 Кейсы':
      await handleCases(ctx)
      break
    case '👤 Профиль':
      await handleProfile(ctx)
      break
  }
})

// ─── Inline keyboard button presses ─────────────────────────────────
bot.on('callback_query', handleCallback)

// ─── Fallback for unknown text ──────────────────────────────────────
bot.on('message:text', async (ctx) => {
  // Don't reply to slash commands
  if (ctx.message?.text?.startsWith('/')) return

  await ctx.reply(
    '🤔 Не понял команду. Жми кнопку внизу 👇',
    { reply_markup: mainMenuKeyboard() }
  )
})

// ─── Error handler ───────────────────────────────────────────────────
bot.catch((err) => {
  console.error('[bot] unhandled error:', err.error)
})
