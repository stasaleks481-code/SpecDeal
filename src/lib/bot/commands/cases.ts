import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type CaseRow, formatNumber } from '@/lib/supabase'
import { money, escapeHtml, cb } from '@/lib/bot/utils'

/** 📦 Кейсы — main menu */
export async function handleCases(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: cases } = await supabase.from('cases').select('*').order('id')

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, balance_sp')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  const { count: totalOpened } = await supabase
    .from('case_openings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.from.id)

  const lines = [
    `📦 <b>КЕЙСЫ</b>`,
    '',
    `📊 Ты открыл: ${totalOpened ?? 0} кейсов`,
    `💼 У тебя: ${money(Number(user?.balance_cr ?? 0))} • ${formatNumber(user?.balance_sp ?? 0)} SP`,
    '',
    `Выбери кейс:`,
  ]

  const kb = new InlineKeyboard()
  for (const c of (cases ?? []) as CaseRow[]) {
    const price = c.price_cr ? `${money(c.price_cr)}` : `${formatNumber(c.price_sp ?? 0)} SP`
    const canAfford = c.price_cr ? Number(user?.balance_cr ?? 0) >= Number(c.price_cr) : Number(user?.balance_sp ?? 0) >= (c.price_sp ?? 0)
    const label = `${c.icon} ${c.name} — ${price}${canAfford ? '' : ' 🔒'}`
    if (canAfford) {
      kb.text(label, cb.case_open(c.code)).row()
    } else {
      kb.text(label, cb.noop()).row()
    }
  }
  kb.text('⬅️ В меню', cb.menu())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Confirm opening */
export async function handleCaseOpen(ctx: Context, caseCode: string): Promise<void> {
  if (!ctx.from) return

  const { data: caseRow } = await supabase
    .from('cases')
    .select('*')
    .eq('code', caseCode)
    .maybeSingle<CaseRow>()

  if (!caseRow) {
    await ctx.answerCallbackQuery({ text: 'Кейс не найден' })
    return
  }

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, balance_sp')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) return

  const price = caseRow.price_cr ? `${money(Number(caseRow.price_cr))}` : `${formatNumber(caseRow.price_sp ?? 0)} SP`
  const canAfford = caseRow.price_cr ? Number(user.balance_cr) >= Number(caseRow.price_cr) : Number(user.balance_sp) >= (caseRow.price_sp ?? 0)

  const lines = [
    `${caseRow.icon} <b>${caseRow.name}</b>`,
    '',
    caseRow.description,
    '',
    `💰 Цена: <b>${price}</b>`,
    `💼 У тебя: ${money(Number(user.balance_cr))} • ${formatNumber(user.balance_sp)} SP`,
    '',
    canAfford ? 'Открываем?' : 'Не хватает денег',
  ]

  const kb = new InlineKeyboard()
  if (canAfford) {
    kb.text(`✅ Открыть за ${price}`, cb.case_open_confirm(caseCode)).row()
  }
  kb.text('⬅️ К кейсам', cb.cases())

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Execute case opening — gacha */
export async function executeCaseOpen(ctx: Context, caseCode: string): Promise<void> {
  if (!ctx.from) return

  const { data: caseRow } = await supabase
    .from('cases')
    .select('*')
    .eq('code', caseCode)
    .maybeSingle<CaseRow>()

  if (!caseRow) {
    await ctx.answerCallbackQuery({ text: 'Кейс не найден' })
    return
  }

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, balance_sp')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) return

  // Check & deduct money
  if (caseRow.price_cr) {
    if (Number(user.balance_cr) < Number(caseRow.price_cr)) {
      await ctx.answerCallbackQuery({ text: 'Не хватает CR' })
      return
    }
    await supabase
      .from('users')
      .update({ balance_cr: Number(user.balance_cr) - Number(caseRow.price_cr) })
      .eq('telegram_id', ctx.from.id)
  } else if (caseRow.price_sp) {
    if (Number(user.balance_sp) < caseRow.price_sp) {
      await ctx.answerCallbackQuery({ text: 'Не хватает SP' })
      return
    }
    await supabase
      .from('users')
      .update({ balance_sp: Number(user.balance_sp) - caseRow.price_sp })
      .eq('telegram_id', ctx.from.id)
  }

  // Determine reward based on case type
  let result: { type: 'car' | 'plate' | 'money'; data: Record<string, unknown> }
  let resultText: string
  let resultEmoji: string

  switch (caseCode) {
    case 'junk':
      // Tier 1-2 car with rare tuning chance
      const tier = Math.random() < 0.8 ? 1 : 2
      const { data: car } = await supabase
        .from('cars_catalog')
        .select('*')
        .eq('tier', tier)
        .range(Math.floor(Math.random() * 10), Math.floor(Math.random() * 10) + 1)
        .maybeSingle()
      if (car) {
        const freeStage = Math.random() < 0.3 ? Math.floor(Math.random() * 3) + 1 : 0
        const cond = 20 + Math.floor(Math.random() * 31)
        const { data: newCar } = await supabase
          .from('user_cars')
          .insert({
            user_id: ctx.from.id,
            catalog_id: car.id,
            body_cond: cond, engine_cond: cond, suspension_cond: cond, interior_cond: cond,
            stage_level: freeStage,
            purchase_price: 0,
            purchase_source: 'case',
          })
          .select('*')
          .single()
        result = { type: 'car', data: { car, newCar, freeStage } }
        resultText = `🚗 ${escapeHtml(car.brand)} ${escapeHtml(car.model)} (${car.year})`
        resultEmoji = car.tier >= 2 ? '⭐' : '🚗'
      } else {
        result = { type: 'money', data: { amount: 5000 } }
        resultText = `💸 $5,000 CR (утешка)`
        resultEmoji = '💸'
      }
      break

    case 'jdm':
      // Japanese car tier 2-4
      const { data: jdmCars } = await supabase
        .from('cars_catalog')
        .select('*')
        .eq('is_jdm', true)
        .in('tier', [2, 3, 4])
      if (jdmCars && jdmCars.length > 0) {
        const random = jdmCars[Math.floor(Math.random() * jdmCars.length)]
        const freeStage = Math.random() < 0.5 ? Math.floor(Math.random() * 3) + 1 : 0
        const cond = 50 + Math.floor(Math.random() * 31)
        const { data: newCar } = await supabase
          .from('user_cars')
          .insert({
            user_id: ctx.from.id,
            catalog_id: random.id,
            body_cond: cond, engine_cond: cond, suspension_cond: cond, interior_cond: cond,
            stage_level: freeStage,
            purchase_price: 0,
            purchase_source: 'case',
          })
          .select('*')
          .single()
        result = { type: 'car', data: { car: random, newCar, freeStage } }
        resultText = `🏎 ${escapeHtml(random.brand)} ${escapeHtml(random.model)} (${random.year})${freeStage ? ` • Stage ${freeStage}!` : ''}`
        resultEmoji = '🏎'
      } else {
        result = { type: 'money', data: { amount: 25000 } }
        resultText = `💸 $25,000 CR (утешка)`
        resultEmoji = '💸'
      }
      break

    case 'plates':
      // Premium plate — 30% elite, 5% legendary
      const plateRoll = Math.random()
      let rarity: 'mirror' | 'hundred' | 'triple' | 'elite' | 'legendary' = 'mirror'
      if (plateRoll < 0.05) rarity = 'legendary'
      else if (plateRoll < 0.30) rarity = 'elite'
      else if (plateRoll < 0.60) rarity = 'triple'
      else rarity = 'hundred'

      const PLATE_RARITY = {
        mirror:    { label: 'Зеркалка', modifier: 1.15 },
        hundred:   { label: 'Сотня',   modifier: 1.25 },
        triple:    { label: 'Тройка',  modifier: 1.50 },
        elite:     { label: 'Блатная', modifier: 1.80 },
        legendary: { label: 'ЛЕГЕНДА', modifier: 2.20 },
      }
      const plateInfo = PLATE_RARITY[rarity]
      // Generate simple plate
      const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
      const rL = () => letters[Math.floor(Math.random() * letters.length)]
      let plateText: string
      switch (rarity) {
        case 'legendary': plateText = 'А777АА'; break
        case 'elite':     plateText = `${rL()}777${rL()}${rL()}`; break
        case 'triple':    plateText = `${rL()}${['111','222','333','444','555','666','777','888','999'][Math.floor(Math.random()*9)]}${rL()}${rL()}`; break
        case 'hundred':   plateText = `${rL()}${['100','200','300','400','500','600','700','800','900'][Math.floor(Math.random()*9)]}${rL()}${rL()}`; break
        default:          plateText = `${rL()}${Math.floor(Math.random()*10)}${Math.floor(Math.random()*10)}${Math.floor(Math.random()*10)}${rL()}${rL()}`
      }
      const region = ['77','99','777','50','78','98'][Math.floor(Math.random()*6)]
      const { data: newPlate } = await supabase
        .from('license_plates')
        .insert({
          user_id: ctx.from.id,
          plate_text: plateText,
          region,
          rarity,
          price_modifier: plateInfo.modifier,
          is_assigned: false,
        })
        .select('*')
        .single()
      result = { type: 'plate', data: { plate: newPlate, rarity } }
      resultText = `🔢 ${plateText} ${region} — ${plateInfo.label}`
      resultEmoji = rarity === 'legendary' ? '🔴' : rarity === 'elite' ? '🟣' : '🟡'
      break

    case 'major':
      // Tier 5-6 car — 80% tier 5, 20% tier 6
      const majorTier = Math.random() < 0.8 ? 5 : 6
      const { data: majorCars } = await supabase
        .from('cars_catalog')
        .select('*')
        .eq('tier', majorTier)
      if (majorCars && majorCars.length > 0) {
        const random = majorCars[Math.floor(Math.random() * majorCars.length)]
        const freeStage = Math.random() < 0.5 ? Math.floor(Math.random() * 3) + 1 : 0
        const cond = 70 + Math.floor(Math.random() * 21)
        const { data: newCar } = await supabase
          .from('user_cars')
          .insert({
            user_id: ctx.from.id,
            catalog_id: random.id,
            body_cond: cond, engine_cond: cond, suspension_cond: cond, interior_cond: cond,
            stage_level: freeStage,
            purchase_price: 0,
            purchase_source: 'case',
          })
          .select('*')
          .single()
        result = { type: 'car', data: { car: random, newCar, freeStage } }
        resultText = `${majorTier === 6 ? '👑' : '💎'} ${escapeHtml(random.brand)} ${escapeHtml(random.model)} (${random.year})${freeStage ? ` • Stage ${freeStage}!` : ''}`
        resultEmoji = majorTier === 6 ? '👑' : '💎'
      } else {
        result = { type: 'money', data: { amount: 100000 } }
        resultText = `💸 $100,000 CR (утешка)`
        resultEmoji = '💸'
      }
      break

    default:
      result = { type: 'money', data: { amount: 1000 } }
      resultText = `💸 $1,000 CR (ошибка)`
      resultEmoji = '💸'
  }

  // Save opening
  await supabase.from('case_openings').insert({
    user_id: ctx.from.id,
    case_id: caseRow.id,
    result_type: result.type,
    result_data: result.data,
  })

  const price = caseRow.price_cr ? `${money(Number(caseRow.price_cr))}` : `${formatNumber(caseRow.price_sp ?? 0)} SP`

  const lines = [
    `${caseRow.icon} <b>ОТКРЫТ ${caseRow.name}</b>`,
    '',
    `        💥`,
    `   ${resultEmoji}`,
    `        💥`,
    '',
    `<b>${resultText}</b>`,
    '',
    `💸 Списано: ${price}`,
  ]

  const kb = new InlineKeyboard()
  // Try again if can still afford
  const newUserBalanceCr = caseRow.price_cr ? Number(user.balance_cr) - Number(caseRow.price_cr) : Number(user.balance_cr)
  const newUserBalanceSp = caseRow.price_sp ? Number(user.balance_sp) - caseRow.price_sp : Number(user.balance_sp)
  const canAgain = caseRow.price_cr ? newUserBalanceCr >= Number(caseRow.price_cr) : newUserBalanceSp >= (caseRow.price_sp ?? 0)
  if (canAgain) {
    kb.text(`🎲 Ещё раз за ${price}`, cb.case_open_confirm(caseCode)).row()
  }
  kb.text('📦 К кейсам', cb.cases())

  await ctx.answerCallbackQuery({ text: `${resultEmoji} ${resultText}`.slice(0, 200) })
  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}
