import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type UserRow, formatNumber } from '@/lib/supabase'
import { money, escapeHtml, cb } from '@/lib/bot/utils'

/**
 * 🏆 Лидерборд топ-10 игроков.
 * Displayed in monospaced block for perfect column alignment.
 */
export async function handleLeaderboard(ctx: Context, sort: 'balance' | 'races' = 'balance'): Promise<void> {
  // Fetch top 10 users by sort criterion
  const sortCol = sort === 'balance' ? 'balance_cr' : 'races_won'
  const { data: leaders, error } = await supabase
    .from('users')
    .select('telegram_id, username, first_name, balance_cr, races_won, races_total, level, reputation')
    .order(sortCol, { ascending: false })
    .limit(10)

  if (error || !leaders) {
    await ctx.answerCallbackQuery({ text: 'Ошибка загрузки' })
    return
  }

  // Find current user position
  const { data: me } = await supabase
    .from('users')
    .select('telegram_id, balance_cr, races_won')
    .eq('telegram_id', ctx.from?.id ?? 0)
    .maybeSingle()

  let myRank: number | null = null
  if (me) {
    const { count: rank } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gt(sortCol, me[sortCol])
    myRank = (rank ?? 0) + 1
  }

  // Build monospaced leaderboard block
  const lines: string[] = []
  lines.push(`🏆 <b>ЛИДЕРБОРД</b>  •  топ по ${sort === 'balance' ? 'балансу' : 'победам'}`)
  lines.push('')
  lines.push('<pre>')  // monospaced block

  // Header row
  lines.push(' #   ИГРОК              БАЛАНС')
  lines.push(' ──  ─────────────────  ──────────')

  for (let i = 0; i < (leaders as UserRow[]).length; i++) {
    const u = (leaders as UserRow[])[i]
    const name = (u.username ?? u.first_name ?? 'Аноним').slice(0, 18).padEnd(18, ' ')
    const bal = money(Number(u.balance_cr)).padStart(10, ' ')
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
    const rankStr = medal.padEnd(3, ' ')

    lines.push(` ${rankStr} ${name}  ${bal}`)
  }

  lines.push('</pre>')

  // Show user's rank if not in top 10
  if (me && myRank && myRank > 10) {
    lines.push('')
    lines.push(`📊 Ты на <b>${myRank}-м</b> месте с ${money(Number(me.balance_cr))}`)
  }

  lines.push('')
  lines.push(`Всего игроков: ${(leaders as UserRow[]).length}+`)

  // Toggle button + back
  const kb = new InlineKeyboard()
  if (sort === 'balance') {
    kb.text('🏁 По победам', 'leaderboard:races')
  } else {
    kb.text('💰 По балансу', 'leaderboard:balance')
  }
  kb.row().text('👤 В профиль', cb.profile())
  kb.row().text('🏠 В меню', cb.menu())

  if (ctx.callbackQuery) {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
  } else {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
  }
}
