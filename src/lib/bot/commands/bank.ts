import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, formatNumber } from '@/lib/supabase'
import { money, escapeHtml, cb } from '@/lib/bot/utils'

const DEPOSIT_RATE_DAILY = 0.015
const LOAN_RATE_DAILY = 0.03

/** 🏦 Банк */
export async function handleBank(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user, error } = await supabase
    .from('users')
    .select('balance_cr, balance_sp, bank_deposit, bank_loan, bank_loan_due_at, garage_slots')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (error || !user) {
    await ctx.reply('Профиль не найден. Нажми /start.')
    return
  }

  const { data: cars } = await supabase
    .from('user_cars')
    .select('purchase_price')
    .eq('user_id', ctx.from.id)

  const carValue = cars?.reduce((sum, c) => sum + Number(c.purchase_price), 0) ?? 0
  const maxLoan = Math.round((Number(user.balance_cr) + carValue) * 0.5)

  const loanDueStr = user.bank_loan_due_at
    ? new Date(user.bank_loan_due_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  const lines = [
    `🏦 <b>БАНК</b>`,
    '',
    `💼 Баланс:     <b>${money(Number(user.balance_cr))}</b>`,
    `💎 Премиум:   ${formatNumber(user.balance_sp)} SP`,
    `📈 Депозит:   <b>${money(Number(user.bank_deposit))}</b>  (+${(DEPOSIT_RATE_DAILY * 100).toFixed(1)}%/день)`,
    `💳 Кредит:    <b>${money(Number(user.bank_loan))}</b>${Number(user.bank_loan) > 0 ? ` (до ${loanDueStr})` : ''}  (-${(LOAN_RATE_DAILY * 100).toFixed(1)}%/день)`,
    '',
    `📊 Лимит кредита: <b>${money(maxLoan)}</b>`,
  ]

  const kb = new InlineKeyboard()
    .text('📈 Положить $10k', cb.bank_deposit_10k())
    .text('📈 $50k', cb.bank_deposit_50k()).row()
    .text('📈 $100k', cb.bank_deposit_100k())
    .text('📉 Снять $10k', cb.bank_withdraw_10k()).row()
    .text('📉 Снять всё', cb.bank_withdraw_all()).row()

  if (Number(user.bank_loan) === 0 && maxLoan >= 50000) {
    kb.text(`💳 Взять $50k`, cb.bank_loan_50k()).row()
  } else if (Number(user.bank_loan) > 0) {
    kb.text('💳 Погасить весь кредит', cb.bank_loan_payoff()).row()
  }
  kb.text('⬅️ В меню', cb.menu())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

// ─── Actions ────────────────────────────────────────────────────────

export async function bankDeposit(ctx: Context, amount: number): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, bank_deposit')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < amount) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
    return
  }

  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) - amount,
      bank_deposit: Number(user.bank_deposit) + amount,
    })
    .eq('telegram_id', ctx.from.id)

  await ctx.answerCallbackQuery({ text: `✅ Положено ${money(amount)}` })
  await handleBank(ctx)
}

export async function bankWithdraw(ctx: Context, amount: number | 'all'): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, bank_deposit')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) return

  const actualAmount = amount === 'all' ? Number(user.bank_deposit) : Math.min(amount, Number(user.bank_deposit))
  if (actualAmount <= 0) {
    await ctx.answerCallbackQuery({ text: 'Депозит пуст' })
    return
  }

  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) + actualAmount,
      bank_deposit: Number(user.bank_deposit) - actualAmount,
    })
    .eq('telegram_id', ctx.from.id)

  await ctx.answerCallbackQuery({ text: `✅ Снято ${money(actualAmount)}` })
  await handleBank(ctx)
}

export async function bankLoan(ctx: Context, amount: number): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, bank_loan, bank_loan_due_at')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) return

  if (Number(user.bank_loan) > 0) {
    await ctx.answerCallbackQuery({ text: 'У тебя уже есть кредит. Сначала погаси.' })
    return
  }

  const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days

  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) + amount,
      bank_loan: Number(user.bank_loan) + amount,
      bank_loan_due_at: due.toISOString(),
    })
    .eq('telegram_id', ctx.from.id)

  await ctx.answerCallbackQuery({ text: `✅ Кредит ${money(amount)} выдан` })
  await handleBank(ctx)
}

export async function bankLoanPayoff(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, bank_loan')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.bank_loan) <= 0) {
    await ctx.answerCallbackQuery({ text: 'Кредита нет' })
    return
  }

  const loanAmount = Number(user.bank_loan)
  if (Number(user.balance_cr) < loanAmount) {
    await ctx.answerCallbackQuery({ text: `Нужно ${money(loanAmount)}, у тебя ${money(Number(user.balance_cr))}` })
    return
  }

  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) - loanAmount,
      bank_loan: 0,
      bank_loan_due_at: null,
    })
    .eq('telegram_id', ctx.from.id)

  await ctx.answerCallbackQuery({ text: `✅ Кредит ${money(loanAmount)} погашен` })
  await handleBank(ctx)
}
