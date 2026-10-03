import type { Context } from 'grammy'
import { supabase, formatNumber } from '@/lib/supabase'

const DEPOSIT_RATE_DAILY = 0.015  // 1.5%
const LOAN_RATE_DAILY = 0.03      // 3%

/**
 * 🏦 Банк — deposits, loans, financial services.
 */
export async function handleBank(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user, error } = await supabase
    .from('users')
    .select('balance_cr, balance_sp, bank_deposit, bank_loan, bank_loan_due_at, garage_slots')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (error || !user) {
    await ctx.reply('⚠️ Профиль не найден. Нажми /start.')
    return
  }

  // Calculate max loan amount: 50% of (total car value + balance)
  const { data: cars } = await supabase
    .from('user_cars')
    .select('purchase_price')
    .eq('user_id', ctx.from.id)

  const carValue = cars?.reduce((sum, c) => sum + Number(c.purchase_price), 0) ?? 0
  const maxLoan = Math.round((user.balance_cr + carValue) * 0.5)

  const loanDueStr = user.bank_loan_due_at
    ? new Date(user.bank_loan_due_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
    : '—'

  const lines = [
    '━━━━━━ 🏦 БАНК И БИЗНЕС ━━━━━━',
    '',
    '━━━━━━ 💰 Твой баланс ━━━━━━',
    `💵 CR: <b>$${formatNumber(user.balance_cr)}</b>`,
    `💎 SP: <b>${formatNumber(user.balance_sp)}</b>`,
    `🏦 Депозит: <b>$${formatNumber(user.bank_deposit)}</b>`,
    `💳 Кредит: <b>$${formatNumber(user.bank_loan)}</b>${user.bank_loan > 0 ? ` (до ${loanDueStr})` : ''}`,
    '',
    '━━━━━━ 📊 Услуги ━━━━━━',
    '',
    `📈 <b>Депозит</b> — ${DEPOSIT_RATE_DAILY * 100}% в сутки`,
    `   Положи деньги под проценты, получай пассивный доход.`,
    `   Минимум: $10,000 CR. Снятие в любой момент.`,
    '',
    `💳 <b>Кредит</b> — ${LOAN_RATE_DAILY * 100}% в сутки`,
    `   Займи до 50% от стоимости активов.`,
    `   Доступно с гаража 3+ слота. Погасить за 3 дня, иначе конфискация авто.`,
    `   Твой лимит: <b>$${formatNumber(maxLoan)} CR</b>`,
    '',
    `🏪 <b>Автосервис</b> — открыть свой СТО ($500k)`,
    `   Игроки смогут заказывать у тебя ремонт со скидкой.`,
    `   Скоро в продаже.`,
    '',
    '━━━━━━ 👇 Команды ━━━━━━',
    '<code>депозит <сумма></code>  — положить деньги',
    '<code>снять <сумма></code>      — снять с депозита',
    '<code>кредит <сумма></code>     — взять кредит',
    '<code>погасить</code>           — погасить весь кредит',
  ]

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}
