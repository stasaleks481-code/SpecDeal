import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type UserCarRow, type CarCatalogRow, STAGE_INFO } from '@/lib/supabase'
import { carTitle, conditionBar, money, escapeHtml, cb } from '@/lib/bot/utils'
import { handleGarage } from '@/lib/bot/commands/garage'

const PAGE_SIZE = 5

/** Show list of cars to pick one for service */
export async function handleWorkshop(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return

  const { data: cars, error } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('user_id', ctx.from.id)
    .order('is_active', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (error) {
    await ctx.reply('Не получилось загрузить.')
    return
  }

  if (!cars || cars.length === 0) {
    const kb = new InlineKeyboard().text('🏬 К салонам', cb.dealers())
    await ctx.reply('🔧 <b>СЕРВИС</b>\n\nУ тебя нет машин. Купи в 🏬 Салонах.', { parse_mode: 'HTML', reply_markup: kb })
    return
  }

  const lines = ['🔧 <b>СЕРВИС</b>', '', 'Выбери машину:']
  const kb = new InlineKeyboard()
  for (const car of cars as (UserCarRow & { catalog: CarCatalogRow })[]) {
    const tierEmoji = ['', '🚗', '🚙', '🏎', '🔥', '💎', '👑'][car.catalog.tier]
    const avg = Math.round((car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4)
    const stage = STAGE_INFO[car.stage_level]
    const active = car.is_active ? ' 🟢' : ''
    lines.push(`${tierEmoji} ${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}${active}`)
    lines.push(`   ${stage.name} • ${avg}% состояние`)
    kb.text(`${car.catalog.brand} ${car.catalog.model.slice(0, 14)} #${car.id.slice(0, 4)}`, cb.ws_car(car.id)).row()
  }
  kb.text('⬅️ В меню', cb.menu())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Service menu for a specific car */
export async function workshopMenuForCar(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car, error } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (error || !car) {
    await ctx.answerCallbackQuery({ text: 'Не найдена' })
    return
  }

  const stage = STAGE_INFO[car.stage_level]
  const bp = Number(car.catalog.base_price)

  const costBody = Math.round(bp * (1 - car.body_cond / 100) * 0.55)
  const costEngine = Math.round(bp * (1 - car.engine_cond / 100) * 0.55)
  const costSusp = Math.round(bp * (1 - car.suspension_cond / 100) * 0.55)
  const costInt = Math.round(bp * (1 - car.interior_cond / 100) * 0.55)
  const totalRepair = costBody + costEngine + costSusp + costInt

  const nextStage = car.stage_level < 3 ? STAGE_INFO[car.stage_level + 1] : null
  const stageCost = nextStage ? Math.round(bp * nextStage.price_mult) : 0

  const lines = [
    `🔧 ${carTitle({ catalog: car.catalog })}`,
    '',
    `🚗 Кузов       ${conditionBar(car.body_cond)} ${car.body_cond}% → ${money(costBody)}`,
    `⚙️ Двигатель  ${conditionBar(car.engine_cond)} ${car.engine_cond}% → ${money(costEngine)}`,
    `🛞 Подвеска   ${conditionBar(car.suspension_cond)} ${car.suspension_cond}% → ${money(costSusp)}`,
    `💺 Салон       ${conditionBar(car.interior_cond)} ${car.interior_cond}% → ${money(costInt)}`,
    '',
    totalRepair > 0 ? `💰 Полный ремонт: <b>${money(totalRepair)}</b>` : '✅ Всё в идеале, чинить нечего',
  ]

  const kb = new InlineKeyboard()

  // Repair buttons (one per part if broken)
  const repairRow: { text: string; callback_data: string }[] = []
  if (car.body_cond < 100) repairRow.push({ text: `🚗 ${money(costBody)}`, callback_data: cb.ws_repair(car.id, 'body') })
  if (car.engine_cond < 100) repairRow.push({ text: `⚙️ ${money(costEngine)}`, callback_data: cb.ws_repair(car.id, 'engine') })
  if (repairRow.length > 0) kb.row(...repairRow)

  const repairRow2: { text: string; callback_data: string }[] = []
  if (car.suspension_cond < 100) repairRow2.push({ text: `🛞 ${money(costSusp)}`, callback_data: cb.ws_repair(car.id, 'suspension') })
  if (car.interior_cond < 100) repairRow2.push({ text: `💺 ${money(costInt)}`, callback_data: cb.ws_repair(car.id, 'interior') })
  if (repairRow2.length > 0) kb.row(...repairRow2)

  if (totalRepair > 0) {
    kb.text(`🔧 Починить ВСЁ за ${money(totalRepair)}`, cb.ws_repair_all(car.id)).row()
  }

  // Stage upgrade
  if (nextStage) {
    kb.text(`🚀 ${nextStage.name} за ${money(stageCost)} (+${Math.round((nextStage.power_mult - 1) * 100)}% л.с.)`, cb.ws_stage(car.id)).row()
  } else {
    kb.text('🚀 Stage 3 уже стоит (максимум)', cb.noop()).row()
  }

  kb.text('⬅️ К машинам', cb.workshop())

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Repair single component */
export async function handleRepairPart(ctx: Context, carId: string, part: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!car) {
    await ctx.answerCallbackQuery({ text: 'Не найдена' })
    return
  }

  const partMap: Record<string, 'body_cond' | 'engine_cond' | 'suspension_cond' | 'interior_cond'> = {
    body: 'body_cond',
    engine: 'engine_cond',
    suspension: 'suspension_cond',
    interior: 'interior_cond',
  }
  const colName = partMap[part]
  if (!colName) {
    await ctx.answerCallbackQuery({ text: 'Неизвестный узел' })
    return
  }

  const current = car[colName]
  if (current >= 100) {
    await ctx.answerCallbackQuery({ text: 'Уже в идеале' })
    return
  }

  const cost = Math.round(Number(car.catalog.base_price) * (1 - current / 100) * 0.55)
  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < cost) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
    return
  }

  // Risk: cheap mechanic can fail
  const riskRoll = Math.random()
  const newCond = riskRoll < 0.1 ? Math.min(100, current + 80) : 100  // 10% chance to repair only to 80%

  // Pay
  await supabase
    .from('users')
    .update({ balance_cr: Number(user.balance_cr) - cost })
    .eq('telegram_id', ctx.from.id)

  // Repair
  await supabase
    .from('user_cars')
    .update({ [colName]: newCond, updated_at: new Date().toISOString() })
    .eq('id', carId)

  const msg = newCond === 100
    ? `✅ ${partLabel(part)}: 100% за ${money(cost)}`
    : `⚠️ ${partLabel(part)}: ${current}% → ${newCond}% (мехник оказался не очень)`
  await ctx.answerCallbackQuery({ text: msg, show_alert: true })
  await workshopMenuForCar(ctx, carId)
}

/** Repair all — show confirm */
export async function handleRepairAll(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!car) {
    await ctx.answerCallbackQuery({ text: 'Не найдена' })
    return
  }

  const bp = Number(car.catalog.base_price)
  const cost = Math.round(
    bp * (1 - car.body_cond / 100) * 0.55 +
    bp * (1 - car.engine_cond / 100) * 0.55 +
    bp * (1 - car.suspension_cond / 100) * 0.55 +
    bp * (1 - car.interior_cond / 100) * 0.55
  )

  const kb = new InlineKeyboard()
    .text(`✅ За ${money(cost)}`, cb.ws_repair_all_confirm(carId))
    .row()
    .text('❌ Отмена', cb.ws_car(carId))

  await ctx.editMessageText(
    [
      `🔧 <b>ПОЛНЫЙ РЕМОНТ</b>`,
      '',
      carTitle({ catalog: car.catalog }),
      '',
      `Все 4 узла → 100%`,
      `Стоимость: <b>${money(cost)}</b>`,
      '',
      'Подтверждаешь?',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

export async function handleRepairAllConfirm(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!car) return

  const bp = Number(car.catalog.base_price)
  const cost = Math.round(
    bp * (1 - car.body_cond / 100) * 0.55 +
    bp * (1 - car.engine_cond / 100) * 0.55 +
    bp * (1 - car.suspension_cond / 100) * 0.55 +
    bp * (1 - car.interior_cond / 100) * 0.55
  )

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < cost) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
    return
  }

  await supabase.from('users').update({ balance_cr: Number(user.balance_cr) - cost }).eq('telegram_id', ctx.from.id)
  await supabase
    .from('user_cars')
    .update({
      body_cond: 100, engine_cond: 100, suspension_cond: 100, interior_cond: 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', carId)

  await ctx.answerCallbackQuery({ text: '✅ Полный ремонт выполнен' })
  await workshopMenuForCar(ctx, carId)
}

/** Stage upgrade */
export async function handleStageUpgrade(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!car || car.stage_level >= 3) {
    await ctx.answerCallbackQuery({ text: 'Уже максимум' })
    return
  }

  const nextStage = STAGE_INFO[car.stage_level + 1]
  const cost = Math.round(Number(car.catalog.base_price) * nextStage.price_mult)

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < cost) {
    await ctx.answerCallbackQuery({ text: `Нужно ${money(cost)}` })
    return
  }

  const kb = new InlineKeyboard()
    .text(`✅ ${nextStage.name} за ${money(cost)}`, cb.ws_stage_confirm(carId))
    .row()
    .text('❌ Отмена', cb.ws_car(carId))

  await ctx.editMessageText(
    [
      `🚀 <b>АПГРЕЙД ТЮНИНГА</b>`,
      '',
      carTitle({ catalog: car.catalog }),
      '',
      `Текущий: ${STAGE_INFO[car.stage_level].name} (${car.catalog.power_hp} л.с.)`,
      `Новый:    <b>${nextStage.name}</b> (${Math.round(car.catalog.power_hp * nextStage.power_mult)} л.с.)`,
      `Прирост:  +${Math.round((nextStage.power_mult - 1) * 100)}% к мощности`,
      `Стоимость: <b>${money(cost)}</b>`,
      '',
      'Подтверждаешь?',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

export async function handleStageConfirm(ctx: Context, carId: string): Promise<void> {
  if (!ctx.from) return

  const { data: car } = await supabase
    .from('user_cars')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', carId)
    .eq('user_id', ctx.from.id)
    .maybeSingle<UserCarRow & { catalog: CarCatalogRow }>()

  if (!car || car.stage_level >= 3) return

  const nextStage = STAGE_INFO[car.stage_level + 1]
  const cost = Math.round(Number(car.catalog.base_price) * nextStage.price_mult)

  const { data: user } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user || Number(user.balance_cr) < cost) return

  await supabase.from('users').update({ balance_cr: Number(user.balance_cr) - cost }).eq('telegram_id', ctx.from.id)
  await supabase
    .from('user_cars')
    .update({ stage_level: car.stage_level + 1, updated_at: new Date().toISOString() })
    .eq('id', carId)

  await ctx.answerCallbackQuery({ text: `✅ ${nextStage.name} установлен!` })
  await workshopMenuForCar(ctx, carId)
}

function partLabel(part: string): string {
  return ({
    body: 'Кузов',
    engine: 'Двигатель',
    suspension: 'Подвеска',
    interior: 'Салон',
  } as Record<string, string>)[part] ?? part
}
