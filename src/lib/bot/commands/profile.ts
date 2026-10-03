import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type UserRow, formatNumber } from '@/lib/supabase'
import { mainMenuKeyboard, escapeHtml } from '@/lib/bot/menus/main'
import { money, cb } from '@/lib/bot/utils'

/**
 * 👤 Профиль — player card.
 */
export async function handleProfile(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle<UserRow>()

  if (error || !user) {
    await ctx.reply('Профиль не найден. Нажми /start')
    return
  }

  const winRate =
    user.races_total > 0 ? Math.round((user.races_won / user.races_total) * 100) : 0

  const statusBadge = getStatusBadge(user.level)
  const reputationStars = formatReputation(user.reputation)

  const { count: carsCount } = await supabase
    .from('user_cars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const { count: platesCount } = await supabase
    .from('license_plates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const { count: achievementsCount } = await supabase
    .from('user_achievements')
    .select('achievement_id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const text = [
    `👤 <b>ПРОФИЛЬ</b>`,
    '',
    `@${user.username ?? escapeHtml(ctx.from.first_name ?? '—')} • ID: ${user.telegram_id}`,
    `${statusBadge} • Ур. ${user.level}`,
    '',
    `💰 CR:       <b>${money(Number(user.balance_cr))}</b>`,
    `💎 SP:       <b>${formatNumber(user.balance_sp)}</b>`,
    `📈 Депозит: <b>${money(Number(user.bank_deposit))}</b>`,
    `💳 Кредит:   <b>${money(Number(user.bank_loan))}</b>`,
    '',
    `🚗 Гараж:       <b>${carsCount ?? 0} / ${user.garage_slots}</b>`,
    `🔢 Номера:      <b>${platesCount ?? 0}</b>`,
    `🎖 Достижения: <b>${achievementsCount ?? 0} / 10</b>`,
    `📈 Сделок:     <b>${user.successful_deals}</b>`,
    `🏁 Гонок:       <b>${user.races_won}</b> / ${user.races_total} (винрейт ${winRate}%)`,
    `⭐ Репутация:  ${reputationStars}`,
  ].join('\n')

  const kb = new InlineKeyboard()
    .text('🏆 Топ игроков', cb.leaderboard())
    .row()
    .text('🏠 В меню', cb.menu())

  // If it's a callback (from inline button) → edit message
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    })
  } else {
    // Reply keyboard button → fresh reply with reply keyboard
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(),
      link_preview_options: { is_disabled: true },
    })
  }
}

function getStatusBadge(level: number): string {
  if (level >= 24) return '🏆 Легенда'
  if (level >= 18) return '👑 Магнат'
  if (level >= 12) return '🔥 Профи'
  if (level >= 6) return '⚡ Перекуп'
  return '🚗 Новичок'
}

function formatReputation(rep: number): string {
  const stars = Math.max(0, Math.min(5, Math.floor(rep / 1000) + 1))
  const filled = '🌟'.repeat(stars)
  const empty = '☆'.repeat(5 - stars)
  return `${filled}${empty} ${rep}/5000`
}
