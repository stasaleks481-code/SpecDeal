import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type UserCarRow, type CarCatalogRow, type LicensePlateRow, TIER_LABELS, STAGE_INFO } from '@/lib/supabase'
import { carTitle, conditionBar, money, shortId, escapeHtml, plateRarityLabel, cb } from '@/lib/bot/utils'

const PAGE_SIZE = 5

/**
 * 🚗 Гараж — list of player's cars with inline buttons to select each.
 */
export async function handleGarage(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return

  const tgId = ctx.from.id
  const { data: cars, error } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('user_id', tgId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (error) {
    console.error('[garage] error:', error)
    await ctx.reply('Не получилось загрузить гараж. Попробуй ещё раз.')
    return
  }

  const { count: total } = await supabase
    .from('user_cars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', tgId)

  const { data: user } = await supabase
    .from('users')
    .select('garage_slots')
    .eq('telegram_id', tgId)
    .maybeSingle()

  const slotsTotal = user?.garage_slots ?? 3
  const slotsUsed = total ?? 0
  const slotsFree = Math.max(0, slotsTotal - slotsUsed)

  // Header
  const lines = [
    `🚗 <b>ГАРАЖ</b>  ${slotsUsed}/${slotsTotal}  (свободно ${slotsFree})`,
  ]

  if (!cars || cars.length === 0) {
    lines.push('')
    lines.push('Пусто. Купи тачку в 🏬 Салонах.')
    const kb = new InlineKeyboard().text('🏬 К салонам', cb.dealers())
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
    return
  }

  lines.push('')

  // One short line per car (no walls of text — selection via button)
  for (const car of cars as (UserCarRow & { catalog: CarCatalogRow })[]) {
    const tier = TIER_LABELS[car.catalog.tier]
    const avg = Math.round((car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4)
    const stage = STAGE_INFO[car.stage_level]
    const active = car.is_active ? ' 🟢' : ''
    const swap = car.engine_swap ? ` ${car.engine_swap}` : ''
    lines.push(`${tier.emoji} ${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}${active}`)
    lines.push(`   ${stage.name}${swap} • ${car.catalog.power_hp}л.с. • ${avg}%`)
    lines.push('')
  }

  // Inline keyboard — one button per car (shows short ID)
  const kb = new InlineKeyboard()
  for (const car of cars as (UserCarRow & { catalog: CarCatalogRow })[]) {
    const label = `${car.catalog.brand} ${car.catalog.model.slice(0, 12)} #${shortId(car.id)}`
    kb.text(label, cb.garage_car(car.id)).row()
  }

  // Pagination if needed
  if (page > 0 || (total ?? 0) > (page + 1) * PAGE_SIZE) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 0) {
      navRow.push({ text: '⬅️', callback_data: `garage:page:${page - 1}` })
    }
    navRow.push({ text: `${page + 1}/${Math.ceil((total ?? 1) / PAGE_SIZE)}`, callback_data: cb.noop() })
    if ((total ?? 0) > (page + 1) * PAGE_SIZE) {
      navRow.push({ text: '➡️', callback_data: `garage:page:${page + 1}` })
    }
    kb.row(...navRow)
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Show single car details */
export async function handleGarageCar(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car, error } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*), plate:license_plates(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow; plate: LicensePlateRow | null }>()

  if (error || !car) {
    await ctx.answerCallbackQuery({ text: 'Машина не найдена' })
    return
  }

  const tier = TIER_LABELS[car.catalog.tier]
  const stage = STAGE_INFO[car.stage_level]
  const effectivePower = Math.round(car.catalog.power_hp * stage.power_mult)
  const npcSellPrice = calcNpcSell(car)

  const lines = [
    `${carTitle({ catalog: car.catalog })}`,
    '',
    `${tier.color} Tier ${car.catalog.tier} • ${car.catalog.power_hp} → ${effectivePower} л.с.`,
    `⚙️ ${car.catalog.engine}`,
    `🚦 ${car.catalog.layout} • ${car.catalog.weight_kg} кг`,
    '',
    `<b>Состояние:</b>`,
    `🚗 Кузов       ${conditionBar(car.body_cond)} ${car.body_cond}%`,
    `🔧 Двигатель  ${conditionBar(car.engine_cond)} ${car.engine_cond}%`,
    `🛞 Подвеска   ${conditionBar(car.suspension_cond)} ${car.suspension_cond}%`,
    `💺 Салон       ${conditionBar(car.interior_cond)} ${car.interior_cond}%`,
    '',
    `🚀 Тюнинг: <b>${stage.name}</b>${car.engine_swap ? ` • swap:${car.engine_swap}` : ''}`,
    `🔢 Номер: ${car.plate ? `${car.plate.plate_text} ${car.plate.region} ${plateRarityLabel(car.plate.rarity)}` : '— не привязан —'}`,
    `💰 Куплено за: ${money(Number(car.purchase_price))}`,
    `📈 Продать NPC: <b>${money(npcSellPrice)}</b>`,
    `📍 Пробег: ${car.mileage_km} км`,
  ]

  const kb = new InlineKeyboard()
  if (!car.is_active) {
    kb.text('🟢 Сделать активной', cb.garage_set_active(car.id)).row()
  } else {
    kb.text('🟢 Активна', cb.noop()).row()
  }
  kb.text('🔧 В сервис', cb.ws_car(car.id))
  kb.text('💵 Продать NPC', cb.garage_sell(car.id)).row()
  kb.text('⬅️ В гараж', cb.garage())

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Set active car */
export async function handleGarageSetActive(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  // Deactivate all user's cars
  await supabase
    .from('user_cars')
    .update({ is_active: false })
    .eq('user_id', ctx.from.id)
    .eq('is_active', true)

  // Activate the chosen one
  const { error } = await supabase
    .from('user_cars')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', carId)
    .eq('user_id', ctx.from.id)

  if (error) {
    await ctx.answerCallbackQuery({ text: 'Ошибка' })
    return
  }

  await ctx.answerCallbackQuery({ text: '✅ Активна!' })
  await handleGarageCar(ctx, carId)
}

/** Sell to NPC */
export async function handleGarageSell(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car, error } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*), plate:license_plates(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow; plate: LicensePlateRow | null }>()

  if (error || !car) {
    await ctx.answerCallbackQuery({ text: 'Не найдена' })
    return
  }

  const sellPrice = calcNpcSell(car)
  const profit = sellPrice - Number(car.purchase_price)
  const profitSign = profit >= 0 ? '📈' : '📉'
  const profitText = `${profitSign} ${profit >= 0 ? '+' : ''}${money(profit)} профит`

  const lines = [
    `💵 <b>ПРОДАЖА NPC</b>`,
    '',
    carTitle({ catalog: car.catalog }),
    '',
    `💰 Тебе заплатят: <b>${money(sellPrice)}</b>`,
    `📊 Куплено за: ${money(Number(car.purchase_price))}`,
    profitText,
    '',
    'Подтверждаешь?',
  ]

  const kb = new InlineKeyboard()
    .text(`✅ Продать за ${money(sellPrice)}`, `garage:sellconfirm:${carId}`)
    .row()
    .text('❌ Отмена', cb.garage_car(carId))

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

export async function handleGarageSellConfirm(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*), plate:license_plates(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow; plate: LicensePlateRow | null }>()

  if (!car) {
    await ctx.answerCallbackQuery({ text: 'Не найдена' })
    return
  }

  const sellPrice = calcNpcSell(car)

  // Update balance
  const { data: user } = await supabase
    .from('users')
    .select('balance_cr, successful_deals')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Профиль не найден' })
    return
  }

  await supabase
    .from('users')
    .update({
      balance_cr: Number(user.balance_cr) + sellPrice,
      successful_deals: (user.successful_deals ?? 0) + 1,
    })
    .eq('telegram_id', ctx.from.id)

  // Detach plate if attached
  if (car.plate_id) {
    await supabase
      .from('license_plates')
      .update({ car_id: null, is_assigned: false })
      .eq('id', car.plate_id)
  }

  // Delete car
  await supabase.from('user_cars').delete().eq('id', carId)

  // Add to marketplace history for price analytics
  await supabase.from('marketplace_history').insert({
    catalog_id: car.catalog_id,
    price: sellPrice,
  })

  await ctx.answerCallbackQuery({ text: `✅ Продано за ${money(sellPrice)}` })
  await ctx.editMessageText(
    [
      `✅ <b>ПРОДАНО</b>`,
      '',
      carTitle({ catalog: car.catalog }),
      '',
      `💵 Получено: ${money(sellPrice)}`,
      `📈 Сделка #${(user.successful_deals ?? 0) + 1} в зачёте`,
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🚗 В гараж', cb.garage()) }
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function calcNpcSell(car: UserCarRow & { catalog: CarCatalogRow; plate: LicensePlateRow | null }): number {
  const stock = Number(car.catalog.base_price) * 1.25
  const stageBonus = Number(car.catalog.base_price) * (STAGE_INFO[car.stage_level]?.price_mult ?? 0) * 0.7
  const plateMod = car.plate?.price_modifier ?? 1
  const avgCond = (car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4
  const condMod = 0.5 + (avgCond / 100) * 0.5  // 50%..100%
  return Math.round((stock + stageBonus) * plateMod * condMod)
}
