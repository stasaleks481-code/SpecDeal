import type { Context } from 'grammy'
import { supabase, type UserRow, formatNumber } from '@/lib/supabase'
import { mainMenuKeyboard, escapeHtml } from '@/lib/bot/menus/main'

/**
 * Profile card — /profile command and "👤 Профиль" button.
 */
export async function handleProfile(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply('⚠️ Не удалось определить пользователя')
    return
  }

  const tg = ctx.from

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', tg.id)
    .maybeSingle<UserRow>()

  if (error || !user) {
    await ctx.reply('⚠️ Профиль не найден. Нажми /start')
    return
  }

  const winRate =
    user.races_total > 0 ? Math.round((user.races_won / user.races_total) * 100) : 0

  const statusBadge = getStatusBadge(user.level)
  const reputationStars = formatReputation(user.reputation)

  const { count: carsCount } = await supabase
    .from('user_cars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', tg.id)

  const { count: platesCount } = await supabase
    .from('license_plates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', tg.id)

  const { count: achievementsCount } = await supabase
    .from('user_achievements')
    .select('achievement_id', { count: 'exact', head: true })
    .eq('user_id', tg.id)

  const text = [
    '💳 ━━━ ПРОФИЛЬ АВТОДИЛЕРА ━━━ 💳',
    '',
    `Игрок: @${user.username ?? escapeHtml(tg.first_name ?? '—')} (ID: ${user.telegram_id})`,
    `Статус: ${statusBadge} (Ур. ${user.level})`,
    '',
    `💰 Баланс: <b>$${formatNumber(user.balance_cr)} CR</b>`,
    `💎 Премиум: <b>${formatNumber(user.balance_sp)} SP</b>`,
    `🏦 Депозит: <b>$${formatNumber(user.bank_deposit)} CR</b>`,
    '',
    `🚗 В гараже: <b>${carsCount ?? 0} / ${user.garage_slots}</b> слотов`,
    `🔢 Номеров в коллекции: <b>${platesCount ?? 0}</b>`,
    `🎖 Достижений: <b>${achievementsCount ?? 0} / 10</b>`,
    `📈 Успешных сделок: <b>${user.successful_deals}</b>`,
    `🏁 Побед в гонках: <b>${user.races_won}</b> (Винрейт: ${winRate}%)`,
    `⭐ Репутация: ${reputationStars}`,
    '',
    '👇 Меню внизу экрана — выбирай раздел',
  ].join('\n')

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(),
    link_preview_options: { is_disabled: true },
  })
}

function getStatusBadge(level: number): string {
  if (level >= 24) return '🏆 Легенда Авторынка'
  if (level >= 18) return '👑 Магнат'
  if (level >= 12) return '🔥 Профи'
  if (level >= 6) return '⚡ Перекупщик'
  return '🚗 Новичок'
}

function formatReputation(rep: number): string {
  const stars = Math.max(0, Math.min(5, Math.floor(rep / 1000) + 1))
  const filled = '🌟'.repeat(stars)
  const empty = '☆'.repeat(5 - stars)
  return `${filled}${empty} ${rep} / 5000`
}
