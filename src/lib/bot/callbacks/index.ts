import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { mainMenuKeyboard, escapeHtml } from '@/lib/bot/menus/main'
import { cb, parseCallback } from '@/lib/bot/utils'
import { handleGarage, handleGarageCar, handleGarageSetActive, handleGarageSell, handleGarageSellConfirm } from '@/lib/bot/commands/garage'
import {
  handleDealerships, browseStateDealership, handleDealerBuy, handleDealerBuyConfirm, browseMarket,
} from '@/lib/bot/commands/dealerships'
import {
  handleWorkshop, workshopMenuForCar, handleRepairPart, handleRepairAll, handleRepairAllConfirm,
  handleStageUpgrade, handleStageConfirm,
} from '@/lib/bot/commands/workshop'
import { handlePlates, handleSpinConfirm, executeSpin } from '@/lib/bot/commands/plates'
import { handleBank, bankDeposit, bankWithdraw, bankLoan, bankLoanPayoff } from '@/lib/bot/commands/bank'
import { handleRaces, runDragVsNpc } from '@/lib/bot/commands/races'
import { handleCases, handleCaseOpen, executeCaseOpen } from '@/lib/bot/commands/cases'
import { handleProfile } from '@/lib/bot/commands/profile'
import { handleLeaderboard } from '@/lib/bot/commands/leaderboard'

/**
 * Inline callback router — every inline button click goes here.
 * Routes to the right handler based on `section:action:args` format.
 */
export async function handleCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) {
    await ctx.answerCallbackQuery()
    return
  }

  const { section, action, args } = parseCallback(data)

  try {
    switch (`${section}:${action}`) {
      // ─── Navigation ─────────────────────────────────────────────
      case 'menu:main':
        await ctx.answerCallbackQuery()
        await ctx.editMessageText(
          [
            `🏎️ <b>SPEC DEAL</b>`,
            '',
            'Жми кнопку внизу 👇',
          ].join('\n'),
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard() }
        )
        break

      // ─── Garage ────────────────────────────────────────────────
      case 'garage:view':
        await ctx.answerCallbackQuery()
        await handleGarage(ctx, 0)
        break
      case 'garage:page':
        await ctx.answerCallbackQuery()
        await handleGarage(ctx, parseInt(args[0] ?? '0', 10))
        break
      case 'garage:car':
        await handleGarageCar(ctx, args[0] ?? '')
        break
      case 'garage:active':
        await handleGarageSetActive(ctx, args[0] ?? '')
        break
      case 'garage:sell':
        await handleGarageSell(ctx, args[0] ?? '')
        break
      case 'garage:sellconfirm':
        await handleGarageSellConfirm(ctx, args[0] ?? '')
        break

      // ─── Dealerships ───────────────────────────────────────────
      case 'dealers:view':
        await ctx.answerCallbackQuery()
        if (ctx.callbackQuery) {
          await handleDealershipsInline(ctx)
        } else {
          await handleDealerships(ctx)
        }
        break
      case 'dealer:open':
        await browseStateDealership(ctx, parseInt(args[0] ?? '1', 10), parseInt(args[1] ?? '0', 10))
        break
      case 'dealer:buy':
        await handleDealerBuy(ctx, parseInt(args[0] ?? '0', 10))
        break
      case 'dealer:buyconfirm':
        await handleDealerBuyConfirm(ctx, parseInt(args[0] ?? '0', 10))
        break
      case 'market:view':
        await browseMarket(ctx, 0)
        break

      // ─── Workshop ──────────────────────────────────────────────
      case 'workshop:view':
        await ctx.answerCallbackQuery()
        await handleWorkshop(ctx, 0)
        break
      case 'ws:car':
        await workshopMenuForCar(ctx, args[0] ?? '')
        break
      case 'ws:repair':
        await handleRepairPart(ctx, args[0] ?? '', args[1] ?? '')
        break
      case 'ws:repairall':
        await handleRepairAll(ctx, args[0] ?? '')
        break
      case 'ws:repairallconfirm':
        await handleRepairAllConfirm(ctx, args[0] ?? '')
        break
      case 'ws:stage':
        await handleStageUpgrade(ctx, args[0] ?? '')
        break
      case 'ws:stageconfirm':
        await handleStageConfirm(ctx, args[0] ?? '')
        break

      // ─── Plates ────────────────────────────────────────────────
      case 'plates:view':
        await ctx.answerCallbackQuery()
        await handlePlatesInline(ctx)
        break
      case 'plates:spin':
        await handleSpinConfirm(ctx)
        break
      case 'plates:spinconfirm':
        await executeSpin(ctx)
        break
      case 'plates:list':
        await ctx.answerCallbackQuery({ text: 'Скоро будет' })
        break

      // ─── Bank ──────────────────────────────────────────────────
      case 'bank:view':
        await ctx.answerCallbackQuery()
        await handleBankInline(ctx)
        break
      case 'bank:dep':
        await bankDeposit(ctx, parseInt(args[0] ?? '0', 10))
        break
      case 'bank:wd':
        if (args[0] === 'all') {
          await bankWithdraw(ctx, 'all')
        } else {
          await bankWithdraw(ctx, parseInt(args[0] ?? '0', 10))
        }
        break
      case 'bank:loan':
        await bankLoan(ctx, parseInt(args[0] ?? '0', 10))
        break
      case 'bank:loanpayoff':
        await bankLoanPayoff(ctx)
        break

      // ─── Races ─────────────────────────────────────────────────
      case 'races:view':
        await ctx.answerCallbackQuery()
        await handleRacesInline(ctx)
        break
      case 'race:dragnpc':
        await runDragVsNpc(ctx, parseInt(args[0] ?? '1000', 10))
        break

      // ─── Cases ─────────────────────────────────────────────────
      case 'cases:view':
        await ctx.answerCallbackQuery()
        await handleCasesInline(ctx)
        break
      case 'case:open':
        await handleCaseOpen(ctx, args[0] ?? '')
        break
      case 'case:openconfirm':
        await executeCaseOpen(ctx, args[0] ?? '')
        break

      // ─── Profile ──────────────────────────────────────────────
      case 'profile:view':
        await ctx.answerCallbackQuery()
        await handleProfile(ctx)
        break

      // ─── Leaderboard ──────────────────────────────────────────
      case 'leaderboard:view':
        await ctx.answerCallbackQuery()
        await handleLeaderboard(ctx, 'balance')
        break
      case 'leaderboard:balance':
        await handleLeaderboard(ctx, 'balance')
        break
      case 'leaderboard:races':
        await handleLeaderboard(ctx, 'races')
        break

      // ─── Cancel / Noop ────────────────────────────────────────
      case 'cancel':
        await ctx.answerCallbackQuery()
        await ctx.editMessageText('Отменено.', { reply_markup: new InlineKeyboard().text('🏠 В меню', cb.menu()) })
        break
      case 'noop':
        await ctx.answerCallbackQuery()
        break

      default:
        await ctx.answerCallbackQuery({ text: 'Неизвестная команда' })
    }
  } catch (err) {
    console.error('[callback] error:', err)
    try {
      await ctx.answerCallbackQuery()
    } catch {
      // already answered
    }
  }
}

// ─── Inline wrappers for reply-keyboard buttons ──────────────────────

async function handleDealershipsInline(ctx: Context): Promise<void> {
  // Reply-keyboard button press — need to send a new message
  await handleDealershipsAsMessage(ctx)
}

async function handleDealershipsAsMessage(ctx: Context): Promise<void> {
  // Replicate handleDealerships but as a fresh message (since Reply keyboard button sends text, not callback)
  const { count: marketCount } = await (await import('@/lib/supabase')).supabase
    .from('market_listings')
    .select('id', { count: 'exact', head: true })
    .is('sold_to', null)
    .gt('expires_at', new Date().toISOString())

  const lines = [
    `🏬 <b>АВТОСАЛОНЫ</b>`,
    '',
    'Где берём тачку?',
  ]

  const kb = new InlineKeyboard()
    .text('🚧 Свалка', cb.dealer_open(1, 0))
    .text('🏛 Бюджет', cb.dealer_open(2, 0)).row()
    .text('🏛 Народный', cb.dealer_open(3, 0))
    .text('🏛 Премиум', cb.dealer_open(4, 0)).row()
    .text(`👥 P2P Маркет (${marketCount ?? 0})`, cb.market())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

async function handlePlatesInline(ctx: Context): Promise<void> {
  // For Reply keyboard button — handlePlates sends a new message
  await handlePlates(ctx)
}

async function handleBankInline(ctx: Context): Promise<void> {
  await handleBank(ctx)
}

async function handleRacesInline(ctx: Context): Promise<void> {
  await handleRaces(ctx)
}

async function handleCasesInline(ctx: Context): Promise<void> {
  await handleCases(ctx)
}
