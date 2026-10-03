import type { Context } from 'grammy'
import { supabase } from '@/lib/supabase'
import { handleStart } from '@/lib/bot/commands/start'
import { handleProfile } from '@/lib/bot/commands/profile'
import { handleGarage } from '@/lib/bot/commands/garage'
import { handleDealerships, browseStateDealership, browseMarket } from '@/lib/bot/commands/dealerships'
import { handleWorkshop, workshopMenuForCar } from '@/lib/bot/commands/workshop'
import { handlePlates, spinPlateRoulette } from '@/lib/bot/commands/plates'
import { handleBank } from '@/lib/bot/commands/bank'
import { handleRaces } from '@/lib/bot/commands/races'
import { handleCases } from '@/lib/bot/commands/cases'
import { mainMenuKeyboard } from '@/lib/bot/menus/main'

/**
 * Main Reply-keyboard router.
 *
 * Each button on the persistent bottom keyboard sends its label as text.
 * We match the exact label with bot.hears() in bot/index.ts, which then
 * calls these handlers.
 *
 * Complex text commands like "купить <ID>" are also routed through here.
 */
export const ROUTES = {
  // Main menu buttons (exact match)
  garage:      '🚗 Гараж',
  dealerships: '🏬 Автосалоны',
  workshop:    '🔧 Мастерская',
  plates:      '🎰 Номера',
  bank:        '🏦 Банк',
  races:       '🏁 Гонки',
  cases:       '📦 Кейсы',
  profile:     '👤 Профиль',
  home:        '🏠 Главное меню',
} as const

/**
 * Resolve a text message to a handler.
 * Returns null if no match.
 */
export async function routeText(ctx: Context): Promise<boolean> {
  if (!ctx.message?.text) return false

  const text = ctx.message.text.trim()

  // Main menu matches (exact)
  switch (text) {
    case ROUTES.garage:
      await handleGarage(ctx)
      return true
    case ROUTES.dealerships:
      await handleDealerships(ctx)
      return true
    case ROUTES.workshop:
      await handleWorkshop(ctx)
      return true
    case ROUTES.plates:
      await handlePlates(ctx)
      return true
    case ROUTES.bank:
      await handleBank(ctx)
      return true
    case ROUTES.races:
      await handleRaces(ctx)
      return true
    case ROUTES.cases:
      await handleCases(ctx)
      return true
    case ROUTES.profile:
      await handleProfile(ctx)
      return true
    case ROUTES.home:
      await ctx.reply(
        [
          '━━━━━━ 🏎 SPEC DEAL ━━━━━━',
          '',
          'Главное меню. Жми кнопку внизу 👇',
        ].join('\n'),
        { reply_markup: mainMenuKeyboard() }
      )
      return true
  }

  // Sub-commands (text prefix matches)
  const lower = text.toLowerCase()

  // Dealership browsing
  if (lower === 'свалка') {
    await browseStateDealership(ctx, 1)
    return true
  }
  if (lower === 'гос бюджет') {
    await browseStateDealership(ctx, 2)
    return true
  }
  if (lower === 'гос народный') {
    await browseStateDealership(ctx, 3)
    return true
  }
  if (lower === 'гос премиум') {
    await browseStateDealership(ctx, 4)
    return true
  }
  if (lower === 'маркет') {
    await browseMarket(ctx)
    return true
  }

  // Plates
  if (lower === 'крутить' || lower === 'крутка' || lower === 'рулетка') {
    await spinPlateRoulette(ctx)
    return true
  }

  // Workshop sub-menu
  if (lower.startsWith('сервис ')) {
    const carId = text.slice(7).trim()
    await workshopMenuForCar(ctx, carId)
    return true
  }

  // Unknown command — hint
  await ctx.reply(
    [
      '🤔 Не понял команду.',
      '',
      'Жми кнопку в меню внизу 👇',
      'Или используй <code>/help</code> для списка команд.',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
  )
  return true
}

/**
 * Unused export — kept for future inline-button support (e.g. confirm dialogs).
 */
export async function handleCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery()
}
