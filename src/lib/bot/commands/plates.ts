import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, PLATE_RARITY, formatNumber } from '@/lib/supabase'
import { money, shortId, escapeHtml, plateRarityLabel, cb } from '@/lib/bot/utils'

const SPIN_COST = 5000

/** 🎰 Номера — main menu */
export async function handlePlates(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { count: total } = await supabase
    .from('license_plates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const { count: unassigned } = await supabase
    .from('license_plates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)
    .eq('is_assigned', false)

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  const lines = [
    `🎰 <b>ГОС. НОМЕРА</b>`,
    '',
    `Стоимость крутки: <b>${money(SPIN_COST)}</b>`,
    `💼 У тебя: ${money(Number(user?.balance_cr ?? 0))}`,
    '',
    `📦 Коллекция: ${total ?? 0} шт.`,
    `📐 Не привязано: ${unassigned ?? 0} шт.`,
    '',
    `<b>Шансы выпадения:</b>`,
    `${PLATE_RARITY.common.emoji} Обычный — ${(PLATE_RARITY.common.chance * 100).toFixed(0)}% (×1.00)`,
    `${PLATE_RARITY.mirror.emoji} Зеркалка — ${(PLATE_RARITY.mirror.chance * 100).toFixed(0)}% (×1.15)`,
    `${PLATE_RARITY.hundred.emoji} Сотня — ${(PLATE_RARITY.hundred.chance * 100).toFixed(0)}% (×1.25)`,
    `${PLATE_RARITY.triple.emoji} Тройка — ${(PLATE_RARITY.triple.chance * 100).toFixed(0)}% (×1.50)`,
    `${PLATE_RARITY.elite.emoji} Блатная — ${(PLATE_RARITY.elite.chance * 100).toFixed(1)}% (×1.80)`,
    `${PLATE_RARITY.legendary.emoji} ЛЕГЕНДА — ${(PLATE_RARITY.legendary.chance * 100).toFixed(1)}% (×2.20)`,
  ]

  const kb = new InlineKeyboard()
  if (user && Number(user.balance_cr) >= SPIN_COST) {
    kb.text(`🎲 Крутануть за ${money(SPIN_COST)}`, cb.plates_spin()).row()
  } else {
    kb.text('💸 Не хватает денег', cb.noop()).row()
  }
  if ((unassigned ?? 0) > 0) {
    kb.text('📋 Привязать номер к машине', `plates:list`).row()
  }
  kb.text('⬅️ В меню', cb.menu())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Show confirm spin screen */
export async function handleSpinConfirm(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < SPIN_COST) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
    return
  }

  const kb = new InlineKeyboard()
    .text(`✅ Крутить за ${money(SPIN_COST)}`, cb.plates_spin_confirm())
    .row()
    .text('❌ Отмена', cb.plates())

  await ctx.editMessageText(
    [
      `🎲 <b>КРУТКА НОМЕРОВ</b>`,
      '',
      `Стоимость: <b>${money(SPIN_COST)}</b>`,
      `Остаток после: ${money(Number(user.balance_cr) - SPIN_COST)}`,
      '',
      `Шанс выбить ЛЕГЕНДУ: 0.3%`,
      `Шанс выбить блатную: 1.2%`,
      '',
      `Поехали?`,
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

/** Execute the spin */
export async function executeSpin(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < SPIN_COST) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
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

  const { plateText, region } = generatePlate(rolledRarity)
  const info = PLATE_RARITY[rolledRarity]

  // Deduct + insert
  await supabase.from('users').update({ balance_cr: Number(user.balance_cr) - SPIN_COST }).eq('telegram_id', ctx.from.id)

  const { data: plate } = await supabase
    .from('license_plates')
    .insert({
      user_id: ctx.from.id,
      plate_text: plateText,
      region,
      rarity: rolledRarity,
      price_modifier: info.modifier,
      is_assigned: false,
    })
    .select('*')
    .single()

  if (!plate) {
    await supabase.from('users').update({ balance_cr: Number(user.balance_cr) }).eq('telegram_id', ctx.from.id)
    await ctx.answerCallbackQuery({ text: 'Ошибка, деньги возвращены' })
    return
  }

  // Fancy response
  let title: string
  let desc: string
  if (rolledRarity === 'legendary') {
    title = '🎉 🎉 🎉 ЛЕГЕНДА!!! 🎉 🎉 🎉'
    desc = 'Невероятно! Таких номеров в игре меньше 0.3%!'
  } else if (rolledRarity === 'elite') {
    title = '🔥 БЛАТНАЯ СЕРИЯ!'
    desc = 'Шанс выпадения всего 1.2% — повезло!'
  } else if (rolledRarity === 'triple') {
    title = '⭐ ТРОЙКА!'
    desc = 'Красота! +50% к цене авто при продаже.'
  } else if (rolledRarity === 'hundred') {
    title = '🟢 Ровная сотня!'
    desc = 'Неплохо, +25% к цене авто.'
  } else if (rolledRarity === 'mirror') {
    title = '🔵 Зеркалка'
    desc = 'Хорошо! +15% к цене авто.'
  } else {
    title = '⬜ Обычный номер'
    desc = 'В следующий раз повезёт больше.'
  }

  const lines = [
    title,
    '',
    `🔢 Твой номер: <code>${plateText} ${region}</code>`,
    `📊 Редкость: ${plateRarityLabel(rolledRarity)}`,
    `💰 Бонус к цене авто: ×${info.modifier.toFixed(2)}`,
    `🏷 ID: <code>${shortId(plate.id)}</code>`,
    '',
    desc,
    '',
    `💸 Списано: ${money(SPIN_COST)}`,
  ]

  const kb = new InlineKeyboard()
  if (Number(user.balance_cr) - SPIN_COST >= SPIN_COST) {
    kb.text(`🎲 Ещё раз за ${money(SPIN_COST)}`, cb.plates_spin_confirm())
  }
  kb.row().text('📋 В коллекцию', cb.plates())

  await ctx.answerCallbackQuery({ text: plateRarityLabel(rolledRarity) })
  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Generate Russian-style plate based on rarity */
function generatePlate(rarity: keyof typeof PLATE_RARITY): { plateText: string; region: string } {
  const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
  const regions = ['77', '99', '177', '777', '50', '78', '98', '96', '199', '197']
  const rL = () => letters[Math.floor(Math.random() * letters.length)]
  const rR = () => regions[Math.floor(Math.random() * regions.length)]

  switch (rarity) {
    case 'legendary':
      return { plateText: 'А777АА', region: '777' }
    case 'elite':
      return { plateText: `${rL()}777${rL()}${rL()}`, region: rR() }
    case 'triple':
      return { plateText: `${rL()}${['111', '222', '333', '444', '555', '666', '777', '888', '999'][Math.floor(Math.random() * 9)]}${rL()}${rL()}`, region: rR() }
    case 'hundred':
      return { plateText: `${rL()}${['100', '200', '300', '400', '500', '600', '700', '800', '900'][Math.floor(Math.random() * 9)]}${rL()}${rL()}`, region: rR() }
    case 'mirror':
      const a = Math.floor(Math.random() * 9) + 1
      const b = Math.floor(Math.random() * 10)
      return { plateText: `${rL()}${a}${b}${a}${rL()}${rL()}`, region: rR() }
    default:
      return {
        plateText: `${rL()}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${rL()}${rL()}`,
        region: rR()
      }
  }
}
