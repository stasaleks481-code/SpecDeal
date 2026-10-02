import type { Context } from 'grammy'
import { supabase, type UserRow } from '@/lib/supabase'
import { buildMainMenu } from '@/lib/bot/menus/main'

/**
 * Profile card — /profile command and "👤 Профиль" button.
 *
 * Format mirrors the spec:
 *   💳 ━━━ ПРОФИЛЬ АВТОДИЛЕРА ━━━ 💳
 *   Игрок: @username (ID: 7849201)
 *   Статус: 🏆 Легенда Авторынка (Ур. 24)
 *   ...
 */
export async function handleProfile(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCallbackQuery({ text: 'Не удалось определить пользователя' })
    return
  }

  const tg = ctx.from

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', tg.id)
    .maybeSingle<UserRow>()

  if (error || !user) {
    await ctx.answerCallbackQuery({ text: 'Профиль не найден. Нажми /start' })
    return
  }

  const winRate =
    user.races_total > 0 ? Math.round((user.races_won / user.races_total) * 100) : 0

  const statusBadge = getStatusBadge(user.level)
  const reputationStars = formatReputation(user.reputation)

  const text = [
    '💳 ━━━ ПРОФИЛЬ АВТОДИЛЕРА ━━━ 💳',
    '',
    `Игрок: @${user.username ?? escapeHtml(tg.first_name ?? '—')} (ID: ${user.telegram_id})`,
    `Статус: ${statusBadge} (Ур. ${user.level})`,
    '',
    `💰 Баланс: <b>$${formatNumber(user.balance_cr)} CR</b>`,
    `💎 Премиум: <b>${formatNumber(user.balance_sp)} SP</b>`,
    '',
    `🚗 Слотов в гараже: <b>${user.garage_slots}</b>`,
    `📈 Успешных сделок: <b>${user.successful_deals}</b>`,
    `🏁 Побед в гонках: <b>${user.races_won}</b> (Винрейт: ${winRate}%)`,
    `⭐ Репутация: ${reputationStars}`,
    '',
    '👇 Действия:',
  ].join('\n')

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Обновить', callback_data: 'profile:view' },
        { text: '🏠 Главное меню', callback_data: 'menu:main' },
      ],
    ],
  }

  // answerCallbackQuery to dismiss the loading spinner
  await ctx.answerCallbackQuery()

  // If this is a callback (button press), edit the existing message;
  // otherwise reply fresh (for /profile text command).
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: true,
    })
  } else {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: true,
    })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function getStatusBadge(level: number): string {
  if (level >= 24) return '🏆 Легенда Авторынка'
  if (level >= 18) return '👑 Магнат'
  if (level >= 12) return '🔥 Профи'
  if (level >= 6) return '⚡ Перекупщик'
  return '🚗 Новичок'
}

function formatReputation(rep: number): string {
  // 0..5 scale, one star per 1000 reputation capped at 5
  const stars = Math.max(0, Math.min(5, Math.floor(rep / 1000) + 1))
  const filled = '🌟'.repeat(stars)
  const empty = '☆'.repeat(5 - stars)
  return `${filled}${empty} ${rep} / 5000`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
