import type { Context } from 'grammy'
import { buildMainMenu, underConstruction } from '@/lib/bot/menus/main'
import { handleProfile } from '@/lib/bot/commands/profile'

/**
 * Central callback router.
 *
 * Every inline button carries a `callback_data` string shaped like
 * `section:action` (e.g. `garage:view`, `market:open`). We switch on
 * the section prefix and dispatch to the right handler.
 *
 * Sections not yet implemented respond with `underConstruction()`
 * so the player always gets feedback instead of a silent click.
 */
export async function handleCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) {
    await ctx.answerCallbackQuery()
    return
  }

  const [section, action] = data.split(':')

  try {
    switch (section) {
      case 'menu':
        if (action === 'main') {
          await ctx.answerCallbackQuery()
          await ctx.editMessageText(
            [
              '━━━━━━ 🏎 SPEC DEAL ━━━━━━',
              '',
              'Главное меню. Выбирай раздел:',
            ].join('\n'),
            { reply_markup: buildMainMenu() }
          )
        }
        break

      case 'profile':
        await handleProfile(ctx)
        break

      case 'garage':
        await ctx.answerCallbackQuery({ text: '🚧 Гараж — в разработке' })
        await ctx.editMessageText(underConstruction('🚗 Мой Гараж'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'search':
        await ctx.answerCallbackQuery({ text: '🚧 Поиск авто — в разработке' })
        await ctx.editMessageText(underConstruction('🔍 Поиск Авто'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'workshop':
        await ctx.answerCallbackQuery({ text: '🚧 Мастерская — в разработке' })
        await ctx.editMessageText(underConstruction('🔧 Мастерская'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'market':
        await ctx.answerCallbackQuery({ text: '🚧 Авторынок — в разработке' })
        await ctx.editMessageText(underConstruction('🎲 Авторынок и Номера'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'bank':
        await ctx.answerCallbackQuery({ text: '🚧 Банк — в разработке' })
        await ctx.editMessageText(underConstruction('🏦 Банк и Бизнес'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'races':
        await ctx.answerCallbackQuery({ text: '🚧 Гонки — в разработке' })
        await ctx.editMessageText(underConstruction('🏁 Гонки'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      case 'cases':
        await ctx.answerCallbackQuery({ text: '🚧 Кейсы — в разработке' })
        await ctx.editMessageText(underConstruction('📦 Кейсы'), {
          reply_markup: { inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'menu:main' }]] },
        })
        break

      default:
        await ctx.answerCallbackQuery({ text: 'Неизвестная команда' })
    }
  } catch (err) {
    console.error('[callback] error:', err)
    // If editMessageText fails because the message content is identical,
    // grammY throws a "message is not modified" error — silently answer
    // the callback query so the spinner goes away on the user's side.
    try {
      await ctx.answerCallbackQuery()
    } catch {
      // already answered — ignore
    }
  }
}
