import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, calcPerfIndex, type UserCarRow, type CarCatalogRow, formatNumber } from '@/lib/supabase'
import { carTitle, money, escapeHtml, cb } from '@/lib/bot/utils'

/** 🏁 Гонки — main menu */
export async function handleRaces(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('races_won, races_total, balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  const winrate = user && user.races_total > 0
    ? Math.round((user.races_won / user.races_total) * 100)
    : 0

  const { data: car, error: carErr } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*), plate:license_plates(*)`)
    .eq('user_id', ctx.from.id)
    .eq('is_active', true)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow; plate: { plate_text: string; region: string; rarity: string } | null }>()

  const lines = [
    `🏁 <b>ГОНОЧНЫЙ ЦЕНТР</b>`,
    '',
    `🏆 Побед: ${user?.races_won ?? 0}  •  Винрейт: ${winrate}%`,
    `💼 Баланс: ${money(Number(user?.balance_cr ?? 0))}`,
    '',
  ]

  if (carErr || !car) {
    lines.push('🚫 Нет активной машины.')
    lines.push('')
    const kb = new InlineKeyboard()
      .text('🚗 В гараж', cb.garage())
      .text('⬅️ В меню', cb.menu())
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
    return
  }

  const stageMult = [1, 1.15, 1.35, 1.70][car.stage_level] ?? 1
  const effectivePower = Math.round(car.catalog.power_hp * stageMult)
  const perf = Math.round(calcPerfIndex(
    car.catalog.power_hp, car.catalog.weight_kg, car.stage_level,
    car.engine_cond, car.suspension_cond, car.has_lsd
  ))

  lines.push(`${carTitle({ catalog: car.catalog })}`)
  lines.push(`⚡ ${effectivePower} л.с. • ${car.catalog.weight_kg} кг • Stage ${car.stage_level}`)
  lines.push(`🛠 Двиг: ${car.engine_cond}% • Подв: ${car.suspension_cond}%`)
  lines.push(`📊 Perf Index: <b>${perf}</b>`)
  lines.push('')
  lines.push(`<b>Выбери гонку:</b>`)

  // Bet tiers — based on user's balance
  const balance = Number(user?.balance_cr ?? 0)
  const bets = [
    { amount: 1000,  label: '1K' },
    { amount: 5000,  label: '5K' },
    { amount: 25000, label: '25K' },
    { amount: 100000, label: '100K', locked: balance < 100000 },
  ]

  const kb = new InlineKeyboard()
  // Drag — available for any car
  kb.text('🏁 Дрэг 402м', cb.noop()).row()
  for (const bet of bets) {
    if (!bet.locked) {
      kb.text(`  💰 ${bet.label}`, cb.race_drag_npc(bet.amount))
    } else {
      kb.text(`  🔒 ${bet.label} (мало $)`, cb.noop())
    }
  }
  kb.row()

  // Ring — needs suspension ≥ 50
  if (car.suspension_cond >= 50) {
    kb.text('🔄 Кольцо (×1.3 выплата)', cb.noop()).row()
  } else {
    kb.text('🔄 Кольцо (нужна подвеска ≥50%)', cb.noop()).row()
  }

  // Drift — needs RWD + Stage 2+
  const canDrift = car.catalog.layout === 'RWD' && car.stage_level >= 2
  if (canDrift) {
    kb.text('💨 Дрифт (×1.5 выплата)', cb.noop()).row()
  } else {
    const reason = car.catalog.layout !== 'RWD' ? 'только RWD' : 'нужен Stage 2+'
    kb.text(`💨 Дрифт (${reason})`, cb.noop()).row()
  }

  kb.text('⬅️ В меню', cb.menu())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Run a drag race vs NPC — generate opponent + simulate */
export async function runDragVsNpc(ctx: Context, bet: number): Promise<void> {
  if (!ctx.from) return

  // Get player car
  const { data: pcar } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('user_id', ctx.from.id)
    .eq('is_active', true)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!pcar) {
    await ctx.answerCallbackQuery({ text: 'Нет активной машины' })
    return
  }

  // Check balance
  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, races_won, races_total')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < bet) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег на ставку' })
    return
  }

  // Generate NPC opponent — similar tier ±1
  const npcTier = Math.max(1, Math.min(6, pcar.catalog.tier + (Math.random() < 0.5 ? -1 : 1)))
  const { data: npcCar } = await supabase
    .from('cars_catalog')
    .select('*')
    .eq('tier', npcTier)
    .range(0, 9)
    .maybeSingle<CarCatalogRow>()

  if (!npcCar) {
    await ctx.answerCallbackQuery({ text: 'Не нашёл соперника' })
    return
  }

  // NPC stats: random stage 0-2, random condition 50-90
  const npcStage = Math.floor(Math.random() * 3)
  const npcEngineCond = 50 + Math.floor(Math.random() * 41)
  const npcSuspCond = 50 + Math.floor(Math.random() * 41)

  const pPerf = calcPerfIndex(pcar.catalog.power_hp, pcar.catalog.weight_kg, pcar.stage_level, pcar.engine_cond, pcar.suspension_cond, pcar.has_lsd)
  const nPerf = calcPerfIndex(npcCar.power_hp, npcCar.weight_kg, npcStage, npcEngineCond, npcSuspCond, false)

  const pWon = pPerf >= nPerf
  const reward = Math.round(bet * 1.8)

  // Update user balance + stats
  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) + (pWon ? reward - bet : -bet),
      races_won: Number(user.races_won) + (pWon ? 1 : 0),
      races_total: Number(user.races_total) + 1,
    })
    .eq('telegram_id', ctx.from.id)

  // Save race
  await supabase.from('races').insert({
    race_type: 'drag',
    distance_m: 402,
    player1_id: ctx.from.id,
    player2_id: null,
    player1_car_id: pcar.id,
    player2_car_id: null,
    player1_perf: pPerf,
    player2_perf: nPerf,
    winner_id: ctx.from.id === ctx.from.id && pWon ? ctx.from.id : -1,
    bet_amount: bet,
    log: {
      player: { car: `${pcar.catalog.brand} ${pcar.catalog.model}`, perf: pPerf },
      npc: { car: `${npcCar.brand} ${npcCar.model}`, perf: nPerf },
    }
  })

  // Generate race replay log
  const replay = generateDragReplay(pcar, npcCar, pPerf, nPerf, pWon)

  const resultText = pWon
    ? `🏆 <b>ПОБЕДА!</b>  +${money(reward)}`
    : `💀 <b>Проиграл</b>  -${money(bet)}`

  const lines = [
    `🏁 <b>ДРЭГ 402м vs NPC</b>`,
    '',
    `Ты:   ${escapeHtml(pcar.catalog.brand)} ${escapeHtml(pcar.catalog.model)} (PI ${Math.round(pPerf)})`,
    `Враг: ${escapeHtml(npcCar.brand)} ${escapeHtml(npcCar.model)} (PI ${Math.round(nPerf)})`,
    '',
    ...replay,
    '',
    resultText,
    `📊 Винрейт: ${Math.round(((Number(user.races_won) + (pWon ? 1 : 0)) / (Number(user.races_total) + 1)) * 100)}%`,
  ]

  const kb = new InlineKeyboard()
  if (Number(user.balance_cr) + (pWon ? reward - bet : -bet) >= bet) {
    kb.text(`🏁 Реванш за ${money(bet)}`, cb.race_drag_npc(bet)).row()
  }
  kb.text('🏁 В гонки', cb.races())

  await ctx.answerCallbackQuery({ text: pWon ? '🏆 Победа!' : 'Проиграл' })
  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Generate race replay text */
function generateDragReplay(
  pcar: UserCarRow & { catalog: CarCatalogRow },
  npcCar: CarCatalogRow,
  pPerf: number,
  nPerf: number,
  pWon: boolean
): string[] {
  const lines: string[] = []
  const stages = ['🟢 СТАРТ', '🔥 60 футов', '⚡ 1/8 мили', '🏁 1/4 мили']
  // The lower perf index catches up at the end
  const ratio = pPerf / (pPerf + nPerf)

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    // Player ahead more on later stages if higher perf
    const playerAhead = Math.random() < (0.5 + (ratio - 0.5) * (i + 1) / stages.length)
    const pEmoji = playerAhead ? '🟩' : '🟥'
    const nEmoji = playerAhead ? '🟥' : '🟩'
    lines.push(`${stage}`)
    lines.push(`   Ты:  ${pEmoji} ${pcar.catalog.brand.slice(0, 8)}`)
    lines.push(`   Он:  ${nEmoji} ${npcCar.brand.slice(0, 8)}`)
  }

  lines.push('')
  lines.push(pWon ? '💨 Ты первый на финише!' : '💀 Соперник ушёл...')
  return lines
}
