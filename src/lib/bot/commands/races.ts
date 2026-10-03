import type { Context } from 'grammy'
import { supabase, calcPerfIndex, type UserCarRow, type CarCatalogRow, formatNumber } from '@/lib/supabase'
import { escapeHtml } from '@/lib/bot/menus/main'

const RACE_TYPES = {
  drag: { name: 'Дрэг 402м', emoji: '🏁', reward_mult: 1.0 },
  ring: { name: 'Кольцо',     emoji: '🔄', reward_mult: 1.3 },
  drift: { name: 'Дрифт',     emoji: '💨', reward_mult: 1.5 },
}

/**
 * 🏁 Гонки — race menu, choose race type + bet.
 */
export async function handleRaces(ctx: Context): Promise<void> {
  if (!ctx.from) return

  // Get user's active car
  const { data: car, error: carErr } = await supabase
    .from('user_cars')
    .select(`
      *,
      catalog:cars_catalog(*),
      plate:license_plates(*)
    `)
    .eq('user_id', ctx.from.id)
    .eq('is_active', true)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow; plate: { plate_text: string; region: string; rarity: string } | null }>()

  if (carErr) {
    console.error('[races] error:', carErr)
    await ctx.reply('⚠️ Ошибка загрузки.')
    return
  }

  // Get stats
  const { data: user } = await supabase
    .from('users')
    .select('races_won, races_total, balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  const winrate = user && user.races_total > 0
    ? Math.round((user.races_won / user.races_total) * 100)
    : 0

  const lines = [
    '━━━━━━ 🏁 ГОНОЧНЫЙ ЦЕНТР ━━━━━━',
    '',
    `📊 Твоя статистика:`,
    `   🏆 Побед: <b>${user?.races_won ?? 0}</b>`,
    `   📈 Всего заездов: <b>${user?.races_total ?? 0}</b>`,
    `   📊 Винрейт: <b>${winrate}%</b>`,
    '',
  ]

  if (!car) {
    lines.push('🚫 У тебя нет активной машины для гонок!')
    lines.push('')
    lines.push('Активируй тачку в гараже командой <code>сел <ID></code>')
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
    return
  }

  const tier = car.catalog.tier
  const stageMult = car.stage_level > 0 ? [1, 1.15, 1.35, 1.70][car.stage_level] : 1
  const effectivePower = Math.round(car.catalog.power_hp * stageMult)
  const perfIndex = calcPerfIndex(
    car.catalog.power_hp,
    car.catalog.weight_kg,
    car.stage_level,
    car.engine_cond,
    car.suspension_cond,
    car.has_lsd
  )

  lines.push('━━━━━━ 🏎 Активная машина ━━━━━━')
  lines.push(`${tierEmoji(tier)} <b>${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}</b> (${car.catalog.year})`)
  lines.push(`   ⚡ Мощность: ${effectivePower} Л.С. (Stage ${car.stage_level})`)
  lines.push(`   ⚖️ Вес: ${car.catalog.weight_kg} кг`)
  lines.push(`   🛠 Состояние: двигатель ${car.engine_cond}%, подвеска ${car.suspension_cond}%`)
  lines.push(`   📊 Perf Index: <b>${Math.round(perfIndex)}</b>`)
  if (car.plate) {
    lines.push(`   🔢 Гос. номер: ${car.plate.plate_text} ${car.plate.region}`)
  }
  lines.push('')
  lines.push('━━━━━━ 🏁 Типы гонок ━━━━━━')
  lines.push('1️⃣ <b>Дрэг (1/4 мили, 402м)</b> — чистая моща и реакция')
  lines.push('   Коэффициент выплаты: ×1.0')
  lines.push('')
  lines.push('2️⃣ <b>Кольцо (3 круга)</b> — нужна идеальная подвеска')
  lines.push('   Коэффициент выплаты: ×1.3')
  lines.push('')
  lines.push('3️⃣ <b>Дрифт-контест</b> — только RWD + Stage 2+')
  lines.push('   Коэффициент выплаты: ×1.5')
  lines.push('')
  lines.push('━━━━━━ 👇 Команды ━━━━━━')
  lines.push('<code>дрэг <ставка></code>  — дрэг vs NPC')
  lines.push('<code>кольцо <ставка></code> — кольцо vs NPC')
  lines.push('<code>дрифт <ставка></code> — дрифт-контест')
  lines.push('<code>pvp</code>         — найти соперника на PvP')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

function tierEmoji(tier: number): string {
  return ['', '🚗', '🚙', '🏎', '🔥', '💎', '👑'][tier] || '🚗'
}
