import type { Context } from 'grammy'
import { supabase, PLATE_RARITY, formatNumber } from '@/lib/supabase'
import { escapeHtml } from '@/lib/bot/menus/main'

const SPIN_COST = 5000

/**
 * 🎰 Номера — show plate inventory + gacha roulette menu.
 */
export async function handlePlates(ctx: Context): Promise<void> {
  if (!ctx.from) return

  // Count player's plates
  const { data: plates } = await supabase
    .from('license_plates')
    .select('id, rarity, plate_text, region, is_assigned, car_id')
    .eq('user_id', ctx.from.id)
    .order('created_at', { ascending: false })

  const total = plates?.length ?? 0
  const unassigned = plates?.filter(p => !p.is_assigned).length ?? 0

  const lines = [
    '━━━━━━ 🎰 ГОС. НОМЕРА ━━━━━━',
    '',
    '🎰 <b>Рулетка номеров</b>',
    `   Стоимость 1 крутки: <b>$${formatNumber(SPIN_COST)} CR</b>`,
    '',
    '━━━━━━ 📊 Шансы выпадения ━━━━━━',
    '',
  ]

  for (const [code, info] of Object.entries(PLATE_RARITY)) {
    const pct = (info.chance * 100).toFixed(1)
    lines.push(`${info.emoji} <b>${info.label}</b> — ${pct}% (множитель цены ×${info.modifier.toFixed(2)})`)
  }

  lines.push('')
  lines.push('━━━━━━ 📜 Твои номера ━━━━━━')
  lines.push(`Всего: <b>${total}</b> • Не привязано: <b>${unassigned}</b>`)

  if (plates && plates.length > 0) {
    lines.push('')
    for (const p of plates.slice(0, 10)) {
      const info = PLATE_RARITY[p.rarity]
      const tag = p.is_assigned ? '✅' : '⬜'
      lines.push(`${tag} ${info.emoji} <code>${p.plate_text} ${p.region}</code> (${info.label})`)
    }
    if (total > 10) {
      lines.push(`... и ещё ${total - 10} номеров`)
    }
  }

  lines.push('')
  lines.push('━━━━━━ 👇 Команды ━━━━━━')
  lines.push(`<code>крутить</code>         — крутануть рулетку ($${formatNumber(SPIN_COST)} CR)`)
  lines.push('<code>номер <ID машины> <ID номера></code> — привязать номер к машине')
  lines.push('<code>продать номер <ID></code> — продать номер NPC')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

/**
 * Spin the plate gacha roulette.
 */
export async function spinPlateRoulette(ctx: Context): Promise<void> {
  if (!ctx.from) return
  const tgId = ctx.from.id

  // Check balance
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', tgId)
    .maybeSingle()

  if (userErr || !user) {
    await ctx.reply('⚠️ Профиль не найден. Нажми /start.')
    return
  }

  if (user.balance_cr < SPIN_COST) {
    await ctx.reply(
      `💸 Недостаточно денег. Нужно <b>$${formatNumber(SPIN_COST)} CR</b>, у тебя: <b>$${formatNumber(user.balance_cr)} CR</b>`,
      { parse_mode: 'HTML' }
    )
    return
  }

  // Roll rarity
  const roll = Math.random()
  let cumulative = 0
  let rolledRarity: keyof typeof PLATE_RARITY = 'common'
  for (const [code, info] of Object.entries(PLATE_RARITY)) {
    cumulative += info.chance
    if (roll < cumulative) {
      rolledRarity = code as keyof typeof PLATE_RARITY
      break
    }
  }

  // Generate plate text based on rarity
  const { plateText, region } = generatePlate(rolledRarity)
  const info = PLATE_RARITY[rolledRarity]

  // Deduct money + insert plate in a single transaction-ish sequence
  const { error: deductErr } = await supabase
    .from('users')
    .update({ balance_cr: user.balance_cr - SPIN_COST })
    .eq('telegram_id', tgId)

  if (deductErr) {
    console.error('[plates] deduct error:', deductErr)
    await ctx.reply('⚠️ Ошибка списания денег.')
    return
  }

  const { data: plate, error: insertErr } = await supabase
    .from('license_plates')
    .insert({
      user_id: tgId,
      plate_text: plateText,
      region,
      rarity: rolledRarity,
      price_modifier: info.modifier,
      is_assigned: false,
      is_listed: false,
    })
    .select('*')
    .single()

  if (insertErr || !plate) {
    // Refund
    await supabase.from('users').update({ balance_cr: user.balance_cr }).eq('telegram_id', tgId)
    console.error('[plates] insert error:', insertErr)
    await ctx.reply('⚠️ Ошибка сохранения номера. Деньги возвращены.')
    return
  }

  // Build response — fancy for rare plates
  const lines: string[] = []
  if (rolledRarity === 'legendary' || rolledRarity === 'elite') {
    lines.push('━━━━━━ 🎉 🎉 🎉 ━━━━━━')
    lines.push('')
    lines.push(`👑 ТЫ ВЫБИЛ <b>${info.label}</b>!`)
    lines.push('')
  } else if (rolledRarity === 'triple' || rolledRarity === 'hundred') {
    lines.push('━━━━━━ ⭐ ⭐ ⭐ ━━━━━━')
    lines.push('')
    lines.push(`✨ Красивый номер: <b>${info.label}</b>!`)
    lines.push('')
  } else if (rolledRarity === 'mirror') {
    lines.push('━━━━━━ 🎰 КРУТКА ━━━━━━')
    lines.push('')
    lines.push(`🔵 Зеркальный номер — неплохо!`)
    lines.push('')
  } else {
    lines.push('━━━━━━ 🎰 КРУТКА ━━━━━━')
    lines.push('')
    lines.push(`⬜ Обычный номер. Повезёт в следующий раз!`)
    lines.push('')
  }

  lines.push(`🔢 Твой номер: <code>${plateText} ${region}</code>`)
  lines.push(`📊 Редкость: <b>${info.label}</b> ${info.emoji}`)
  lines.push(`💰 Бонус к цене авто: ×${info.modifier.toFixed(2)}`)
  lines.push(`🏷 ID номера: <code>${plate.id.slice(0, 8)}</code>`)
  lines.push('')
  lines.push(`💸 Списано: $${formatNumber(SPIN_COST)} CR`)
  lines.push('')
  lines.push('👇 Жми <b>🎰 Номера</b> чтобы крутить ещё или привязать к машине.')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

/**
 * Generate a random Russian-style license plate based on rarity tier.
 * Format: Letter+3digits+2letters + region (e.g. "А777АА 777")
 */
function generatePlate(rarity: keyof typeof PLATE_RARITY): { plateText: string; region: string } {
  const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
  const regions = ['77', '99', '177', '777', '50', '78', '98', '96', '199', '197', '750']

  let plate: string
  let region: string

  switch (rarity) {
    case 'legendary':
      // А777АА 777 — triple-7 with elite letter combo
      plate = `А777АА`
      region = '777'
      break

    case 'elite':
      // O...OO or A...AA — same letter triple / double
      plate = `${letters[Math.floor(Math.random() * letters.length)]}777${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}`
      region = regions[Math.floor(Math.random() * regions.length)]
      break

    case 'triple':
      // X777XX, X999XX — triple digits
      const tripleDigit = ['111', '222', '333', '444', '555', '666', '777', '888', '999'][Math.floor(Math.random() * 9)]
      const l1 = letters[Math.floor(Math.random() * letters.length)]
      plate = `${l1}${tripleDigit}${l1}${letters[Math.floor(Math.random() * letters.length)]}`
      region = regions[Math.floor(Math.random() * regions.length)]
      break

    case 'hundred':
      // X100XX, X700XX — round hundreds
      const hundredDigit = ['100', '200', '300', '400', '500', '600', '700', '800', '900'][Math.floor(Math.random() * 9)]
      plate = `${letters[Math.floor(Math.random() * letters.length)]}${hundredDigit}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}`
      region = regions[Math.floor(Math.random() * regions.length)]
      break

    case 'mirror':
      // X121XX, X505XX — palindrome-like
      const a = Math.floor(Math.random() * 9) + 1
      const b = Math.floor(Math.random() * 10)
      plate = `${letters[Math.floor(Math.random() * letters.length)]}${a}${b}${a}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}`
      region = regions[Math.floor(Math.random() * regions.length)]
      break

    default:
      // Common — fully random
      plate = `${letters[Math.floor(Math.random() * letters.length)]}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}`
      region = regions[Math.floor(Math.random() * regions.length)]
  }

  return { plateText: plate, region }
}
