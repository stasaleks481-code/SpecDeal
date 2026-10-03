import type { Context } from 'grammy'
import { supabase, type UserCarRow, type CarCatalogRow, STAGE_INFO, formatNumber } from '@/lib/supabase'
import { escapeHtml } from '@/lib/bot/menus/main'

/**
 * 🔧 Мастерская — shows player's cars for service selection.
 */
export async function handleWorkshop(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: cars, error } = await supabase
    .from('user_cars')
    .select(`
      *,
      catalog:cars_catalog(*)
    `)
    .eq('user_id', ctx.from.id)
    .order('is_active', { ascending: false })

  if (error) {
    console.error('[workshop] error:', error)
    await ctx.reply('⚠️ Не удалось загрузить гараж.')
    return
  }

  if (!cars || cars.length === 0) {
    await ctx.reply(
      [
        '━━━━━━ 🔧 МАСТЕРСКАЯ ━━━━━━',
        '',
        '🔇 У тебя нет машин для ремонта.',
        '',
        '👇 Купи тачку в 🏬 Автосалонах, потом возвращайся.',
      ].join('\n'),
      { parse_mode: 'HTML' }
    )
    return
  }

  const lines = [
    '━━━━━━ 🔧 МАСТЕРСКАЯ ━━━━━━',
    '',
    'Выбери машину для сервиса (текстом):',
    '<code>сервис <ID></code> — открыть меню машины',
    '',
    '━━━━━━ 🚗 Твои машины ━━━━━━',
    '',
  ]

  for (const car of cars as (UserCarRow & { catalog: CarCatalogRow })[]) {
    const tier = TIER_LABELS_GET(car.catalog.tier)
    const avg = Math.round((car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4)
    const stageTag = car.stage_level > 0 ? ` • ${STAGE_INFO[car.stage_level].name}` : ''
    const activeTag = car.is_active ? ' 🟢' : ''

    lines.push(
      `${tier.emoji} <b>${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}</b> (${car.catalog.year})${activeTag}`,
      `   🛠 ${avg}% • ${car.catalog.power_hp} Л.С.${stageTag}`,
      `   🏷 ID: <code>${car.id.slice(0, 8)}</code>`,
      ''
    )
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

function TIER_LABELS_GET(tier: number) {
  const map: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '🚗', color: '🟫' },
    2: { emoji: '🚙', color: '🟦' },
    3: { emoji: '🏎', color: '🟪' },
    4: { emoji: '🔥', color: '🟨' },
    5: { emoji: '💎', color: '🟥' },
    6: { emoji: '👑', color: '⬛' },
  }
  return map[tier] ?? { emoji: '🚗', color: '⬜' }
}

/**
 * Show workshop menu for a specific car — repair/stage/swap options.
 */
export async function workshopMenuForCar(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car, error } = await supabase
    .from('user_cars')
    .select(`
      *,
      catalog:cars_catalog(*)
    `)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (error || !car) {
    await ctx.reply('⚠️ Машина не найдена. Проверь ID.')
    return
  }

  const stage = STAGE_INFO[car.stage_level]
  const repairCostBody = Math.round(car.catalog.base_price * (1 - car.body_cond / 100) * 0.55)
  const repairCostEngine = Math.round(car.catalog.base_price * (1 - car.engine_cond / 100) * 0.55)
  const repairCostSusp = Math.round(car.catalog.base_price * (1 - car.suspension_cond / 100) * 0.55)
  const repairCostInt = Math.round(car.catalog.base_price * (1 - car.interior_cond / 100) * 0.55)
  const totalRepair = repairCostBody + repairCostEngine + repairCostSusp + repairCostInt

  const nextStage = car.stage_level < 3 ? STAGE_INFO[car.stage_level + 1] : null
  const stageCost = nextStage ? Math.round(car.catalog.base_price * nextStage.price_mult) : 0

  const lines = [
    `━━━━━━ 🔧 СЕРВИС: ${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)} ━━━━━━`,
    '',
    `🛠 Состояние узлов:`,
    `   🚗 Кузов:       ${condBar(car.body_cond)} ${car.body_cond}%   — ремонт: $${formatNumber(repairCostBody)}`,
    `   ⚙️ Двигатель:   ${condBar(car.engine_cond)} ${car.engine_cond}%   — ремонт: $${formatNumber(repairCostEngine)}`,
    `   🛞 Подвеска:   ${condBar(car.suspension_cond)} ${car.suspension_cond}%   — ремонт: $${formatNumber(repairCostSusp)}`,
    `   💺 Салон:      ${condBar(car.interior_cond)} ${car.interior_cond}%   — ремонт: $${formatNumber(repairCostInt)}`,
    '',
    `💰 Полный ремонт всех узлов: <b>$${formatNumber(totalRepair)} CR</b>`,
    '',
    `🚀 Текущий тюнинг: <b>${stage.name}</b> (${car.catalog.power_hp} → ${Math.round(car.catalog.power_hp * stage.power_mult)} Л.С.)`,
  ]

  if (nextStage) {
    lines.push(`⬆️ Следующий уровень: <b>${nextStage.name}</b> (+${Math.round((nextStage.power_mult - 1) * 100)}% Л.С.)`)
    lines.push(`   Стоимость апгрейда: <b>$${formatNumber(stageCost)} CR</b>`)
  } else {
    lines.push('⬆️ Достигнут максимальный Stage 3')
  }

  if (car.engine_swap) {
    lines.push(`🔧 Swap двигателя: <b>${car.engine_swap}</b>`)
  }

  lines.push('')
  lines.push('━━━━━━ 👇 Команды ━━━━━━')
  lines.push('<code>ремонт кузов <ID></code>     — починить кузов')
  lines.push('<code>ремонт двигатель <ID></code> — починить двигатель')
  lines.push('<code>ремонт подвеска <ID></code> — починить подвеску')
  lines.push('<code>ремонт салон <ID></code>     — починить салон')
  lines.push('<code>ремонт всё <ID></code>       — полный ремонт')
  lines.push('<code>стейдж <ID></code>           — апгрейд Stage (1→2→3)')
  lines.push('<code>swap <ID> 2JZ-GTE</code>     — swap мотора (Tier 1-3)')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

function condBar(pct: number): string {
  const filled = Math.floor(pct / 10)
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}
