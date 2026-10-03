import type { Context } from 'grammy'
import { supabase, type CaseRow, formatNumber } from '@/lib/supabase'

/**
 * 📦 Кейсы — 4 case types with gacha mechanics.
 */
export async function handleCases(ctx: Context): Promise<void> {
  if (!ctx.from) return

  // Fetch cases
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .order('id')

  if (error) {
    console.error('[cases] error:', error)
    await ctx.reply('⚠️ Ошибка загрузки кейсов.')
    return
  }

  // Get user balance
  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, balance_sp')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  // Get case opening stats
  const { count: totalOpened } = await supabase
    .from('case_openings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const lines = [
    '━━━━━━ 📦 КЕЙСЫ ━━━━━━',
    '',
    `📊 Ты открыл: <b>${totalOpened ?? 0}</b> кейсов`,
    `💰 Баланс: <b>$${formatNumber(user?.balance_cr ?? 0)} CR</b> / <b>${formatNumber(user?.balance_sp ?? 0)} SP</b>`,
    '',
    '━━━━━━ 📦 Доступные кейсы ━━━━━━',
    '',
  ]

  for (const c of (cases ?? []) as CaseRow[]) {
    const price = c.price_cr ? `$${formatNumber(c.price_cr)} CR` : `${formatNumber(c.price_sp ?? 0)} SP`
    lines.push(`${c.icon} <b>${c.name}</b>`)
    lines.push(`   ${c.description}`)
    lines.push(`   💰 Цена: <b>${price}</b>`)
    lines.push(`   🏷 Код: <code>${c.code}</code>`)
    lines.push('')
  }

  lines.push('━━━━━━ 👇 Команды ━━━━━━')
  lines.push('<code>открыть junk</code>     — открыть Утиль-Секрет ($10k)')
  lines.push('<code>открыть jdm</code>      — открыть JDM Power ($50k)')
  lines.push('<code>открыть plates</code>  — открыть Блатные Номера ($25k)')
  lines.push('<code>открыть major</code>    — открыть Кейс Мажор (50 SP)')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}
