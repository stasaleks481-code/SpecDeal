import type { Context } from 'grammy'
import { supabase, type UserCarRow, type CarCatalogRow, type LicensePlateRow, TIER_LABELS, STAGE_INFO, formatNumber } from '@/lib/supabase'
import { escapeHtml } from '@/lib/bot/menus/main'

/**
 * 🚗 Гараж — list all cars owned by player, show active one, slots used.
 * Triggered by Reply-keyboard button "🚗 Гараж" or /garage command.
 */
export async function handleGarage(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const tgId = ctx.from.id

  // Fetch all user cars + catalog join + plate
  const { data: cars, error } = await supabase
    .from('user_cars')
    .select(`
      *,
      catalog:cars_catalog(*),
      plate:license_plates(*)
    `)
    .eq('user_id', tgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[garage] fetch error:', error)
    await ctx.reply('⚠️ Не удалось загрузить гараж. Попробуй позже.')
    return
  }

  // Get user's garage_slots
  const { data: user } = await supabase
    .from('users')
    .select('garage_slots')
    .eq('telegram_id', tgId)
    .maybeSingle()

  const slotsTotal = user?.garage_slots ?? 3
  const slotsUsed = cars?.length ?? 0
  const slotsFree = Math.max(0, slotsTotal - slotsUsed)

  if (!cars || cars.length === 0) {
    await ctx.reply(
      [
        '━━━━━━ 🚗 МОЙ ГАРАЖ ━━━━━━',
        '',
        '🔇 Гараж пуст.',
        '',
        `📊 Слотов: <b>${slotsUsed} / ${slotsTotal}</b> (свободно: ${slotsFree})`,
        '',
        '👇 Чтобы получить тачку:',
        '',
        '1️⃣ Жми <b>🏬 Автосалоны</b> внизу',
        '2️⃣ Иди на Свалку или в Гос. салон',
        '3️⃣ Покупай утиль и восстанавливай',
      ].join('\n'),
      { parse_mode: 'HTML' }
    )
    return
  }

  // Build car list
  const lines: string[] = [
    '━━━━━━ 🚗 МОЙ ГАРАЖ ━━━━━━',
    '',
    `📊 Слотов: <b>${slotsUsed} / ${slotsTotal}</b> (свободно: ${slotsFree})`,
    '',
  ]

  for (const car of cars as (UserCarRow & { catalog: CarCatalogRow; plate: LicensePlateRow | null })[]) {
    const tier = TIER_LABELS[car.catalog.tier]
    const stage = STAGE_INFO[car.stage_level]
    const avgCond = Math.round((car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4)
    const condBar = conditionBar(avgCond)
    const isActive = car.is_active ? ' 🟢 АКТИВНАЯ' : ''
    const plateStr = car.plate ? `[${car.plate.plate_text} ${car.plate.region}]` : '[без номеров]'

    lines.push(
      `${tier.emoji} <b>${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}</b> (${car.catalog.year})${isActive}`,
      `   ${tier.color} Tier ${car.catalog.tier} • ${stage.name} • ${car.catalog.power_hp}${car.engine_swap ? `→swap` : ''} Л.С.`,
      `   🛠 ${condBar} ${avgCond}%`,
      `   🔢 ${plateStr}${car.plate ? ` ${tier_label_for_plate(car.plate.rarity)}` : ''}`,
      `   🏷 ID: <code>${car.id.slice(0, 8)}</code>`,
      ''
    )
  }

  lines.push('👇 Действия (отправь текстом):')
  lines.push('')
  lines.push('<code>сел <ID></code> — сделать активной')
  lines.push('<code>продать <ID></code> — продать NPC')
  lines.push('<code>инфо <ID></code> — детали машины')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

function conditionBar(pct: number): string {
  const filled = Math.floor(pct / 10)
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

function tier_label_for_plate(rarity: string): string {
  const labels: Record<string, string> = {
    common: '(обычный)',
    mirror: '(зеркалка)',
    hundred: '(сотня)',
    triple: '(тройка ⭐)',
    elite: '(блатная 🔥)',
    legendary: '(ЛЕГЕНДА 👑)',
  }
  return labels[rarity] ?? ''
}
