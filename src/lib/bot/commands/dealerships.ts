import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { supabase, type DealershipRow, type DealershipInventoryRow, type CarCatalogRow, type MarketListingRow, TIER_LABELS, formatNumber } from '@/lib/supabase'
import { carTitle, conditionBar, money, shortId, escapeHtml, cb } from '@/lib/bot/utils'

const PAGE_SIZE = 4

/**
 * 🏬 Автосалоны — main menu with dealership selection.
 */
export async function handleDealerships(ctx: Context): Promise<void> {
  // Count market listings for the badge
  const { count: marketCount } = await supabase
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
    .text('🏛 Гос. Бюджет', cb.dealer_open(2, 0)).row()
    .text('🏛 Гос. Народный', cb.dealer_open(3, 0))
    .text('🏛 Гос. Премиум', cb.dealer_open(4, 0)).row()
    .text(`👥 P2P Маркет (${marketCount ?? 0})`, cb.market())

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Browse dealership inventory with pagination */
export async function browseStateDealership(ctx: Context, dealershipId: number, page: number = 0): Promise<void> {
  if (!ctx.from) return

  const { data, error } = await supabase
    .from('dealerships')
    .select(`*, inventory:dealership_inventory!inner(*, catalog:cars_catalog(*))`)
    .eq('id', dealershipId)
    .maybeSingle<DealershipRow & { inventory: (DealershipInventoryRow & { catalog: CarCatalogRow })[] }>()

  if (error || !data) {
    await ctx.answerCallbackQuery({ text: 'Салон не найден' })
    return
  }

  const total = data.inventory.length
  const paged = data.inventory.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const lines = [
    `${data.name}`,
    '',
    `📦 В наличии: ${total} моделей`,
    '',
  ]

  for (const item of paged) {
    const tier = TIER_LABELS[item.catalog.tier]
    const jdm = item.catalog.is_jdm ? ' 🇯🇵' : ''
    lines.push(`${tier.emoji} ${escapeHtml(item.catalog.brand)} ${escapeHtml(item.catalog.model)}${jdm}`)
    lines.push(`   T${item.catalog.tier} • ${item.catalog.power_hp}л.с. • ${conditionBar(item.condition)} ${item.condition}%`)
    lines.push(`   ${money(item.price)} • в наличии ${item.stock} шт.`)
    lines.push('')
  }

  const kb = new InlineKeyboard()
  for (const item of paged) {
    const c = item.catalog
    kb.text(`${c.brand} ${c.model.slice(0, 14)} — ${money(item.price)}`, cb.dealer_buy(item.id)).row()
  }

  // Pagination
  if (page > 0 || total > (page + 1) * PAGE_SIZE) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 0) navRow.push({ text: '⬅️', callback_data: cb.dealer_open(dealershipId, page - 1) })
    navRow.push({ text: `${page + 1}/${Math.ceil(total / PAGE_SIZE)}`, callback_data: cb.noop() })
    if (total > (page + 1) * PAGE_SIZE) navRow.push({ text: '➡️', callback_data: cb.dealer_open(dealershipId, page + 1) })
    kb.row(...navRow)
  }
  kb.text('⬅️ К салонам', cb.dealers())

  if (ctx.callbackQuery) {
    await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
  } else {
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
  }
}

/** Show buy confirm for a dealership car */
export async function handleDealerBuy(ctx: Context, invId: number): Promise<void> {
  if (!ctx.from) return

  const { data: item, error } = await supabase
    .from('dealership_inventory')
    .select(`*, catalog:cars_catalog(*), dealership:dealerships(*)`)
    .eq('id', invId)
    .maybeSingle<DealershipInventoryRow & { catalog: CarCatalogRow; dealership: DealershipRow }>()

  if (error || !item) {
    await ctx.answerCallbackQuery({ text: 'Не найдено' })
    return
  }

  const user = await getUserBalance(ctx.from.id)
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Профиль не найден' })
    return
  }

  const canAfford = Number(user.balance_cr) >= Number(item.price)
  const slotsFree = await getFreeGarageSlots(ctx.from.id)

  const lines = [
    `🛒 <b>ПОКУПКА</b>`,
    '',
    carTitle({ catalog: item.catalog }),
    '',
    `⚙️ ${item.catalog.engine}`,
    `🚦 ${item.catalog.layout} • ${item.catalog.power_hp} л.с. • ${item.catalog.weight_kg} кг`,
    `🛠 Состояние: ${item.condition}%`,
    '',
    `💰 Цена: <b>${money(item.price)}</b>`,
    `💼 У тебя: ${money(Number(user.balance_cr))}`,
    canAfford ? '✅ Денег хватает' : '❌ Не хватает денег',
    `🚗 Слотов свободно: ${slotsFree}`,
    slotsFree > 0 ? '✅ Есть место в гараже' : '❌ Гараж забит',
    '',
    canAfford && slotsFree > 0 ? 'Подтверждаешь покупку?' : 'Не сейчас.',
  ]

  const kb = new InlineKeyboard()
  if (canAfford && slotsFree > 0) {
    kb.text(`✅ Купить за ${money(item.price)}`, cb.dealer_buy_confirm(invId)).row()
  }
  kb.text('⬅️ Назад', cb.dealer_open(item.dealership_id, 0))

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

/** Actually execute the purchase */
export async function handleDealerBuyConfirm(ctx: Context, invId: number): Promise<void> {
  if (!ctx.from) return

  const { data: item } = await supabase
    .from('dealership_inventory')
    .select(`*, catalog:cars_catalog(*)`)
    .eq('id', invId)
    .maybeSingle<DealershipInventoryRow & { catalog: CarCatalogRow }>()

  if (!item) {
    await ctx.answerCallbackQuery({ text: 'Уже продали' })
    return
  }

  const user = await getUserBalance(ctx.from.id)
  if (!user || Number(user.balance_cr) < Number(item.price)) {
    await ctx.answerCallbackQuery({ text: 'Не хватает денег' })
    return
  }

  const slotsFree = await getFreeGarageSlots(ctx.from.id)
  if (slotsFree <= 0) {
    await ctx.answerCallbackQuery({ text: 'Гараж забит' })
    return
  }

  // Deduct money
  await supabase
    .from('users')
    .update({ balance_cr: Number(user.balance_cr) - Number(item.price) })
    .eq('telegram_id', ctx.from.id)

  // Create user car with broken condition (junkyard style)
  const isFirstCar = (await supabase.from('user_cars').select('id', { count: 'exact', head: true }).eq('user_id', ctx.from.id)).count === 0

  const { data: newCar, error: carErr } = await supabase
    .from('user_cars')
    .insert({
      user_id: ctx.from.id,
      catalog_id: item.catalog_id,
      body_cond: item.condition,
      engine_cond: item.condition,
      suspension_cond: item.condition,
      interior_cond: item.condition,
      purchase_price: item.price,
      purchase_source: 'dealership_state',
      is_active: isFirstCar,
    })
    .select('*')
    .single()

  if (carErr || !newCar) {
    // Refund
    await supabase.from('users').update({ balance_cr: Number(user.balance_cr) }).eq('telegram_id', ctx.from.id)
    await ctx.answerCallbackQuery({ text: 'Ошибка' })
    return
  }

  // Reduce stock
  const newStock = item.stock - 1
  if (newStock <= 0) {
    await supabase.from('dealership_inventory').delete().eq('id', invId)
  } else {
    await supabase.from('dealership_inventory').update({ stock: newStock }).eq('id', invId)
  }

  // Random small event: hidden defect
  const events = [
    { chance: 0.15, text: '🔍 При осмотре нашли скрытый дефект — кузов на 10% хуже, чем казалось.', damage: { body: -10 } },
    { chance: 0.10, text: '🔧 После тест-драйва подвеска показала себя хуже ожидаемого (-10%).', damage: { suspension: -10 } },
    { chance: 0.05, text: '✨ Бонус! В бардачке нашли набор фирменных ковриков — салон +5%.', damage: { interior: 5 } },
    { chance: 0.85, text: '✅ Без сюрпризов — машина соответствует описанию.', damage: {} },
  ]
  let rolled = events[3]
  const roll = Math.random()
  let cum = 0
  for (const e of events) {
    cum += e.chance
    if (roll < cum) { rolled = e; break }
  }

  // Apply event damage to the new car
  if (Object.keys(rolled.damage).length > 0) {
    const updates: Record<string, number> = {}
    for (const [part, delta] of Object.entries(rolled.damage)) {
      const current = (newCar as Record<string, unknown>)[`${part}_cond`] as number
      updates[`${part}_cond`] = Math.max(0, Math.min(100, current + delta))
    }
    await supabase.from('user_cars').update(updates).eq('id', newCar.id)
  }

  const profitHint = isFirstCar ? '\n\n🎉 Твоя первая тачка! Достижение "Первая тачка" получено.' : ''

  await ctx.answerCallbackQuery({ text: '✅ Куплено!' })
  await ctx.editMessageText(
    [
      `✅ <b>КУПЛЕНО</b>`,
      '',
      carTitle({ catalog: item.catalog }),
      '',
      `💵 Списано: ${money(Number(item.price))}`,
      `💼 Остаток: ${money(Number(user.balance_cr) - Number(item.price))}`,
      '',
      rolled.text,
      profitHint,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🚗 В гараж', cb.garage())
        .text('🔧 В сервис', cb.ws_car(newCar.id)),
    }
  )
}

// ─── P2P Market ──────────────────────────────────────────────────────

export async function browseMarket(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return

  const { data: listings, error } = await supabase
    .from('market_listings')
    .select(`*, car:user_cars(*, catalog:cars_catalog(*), plate:license_plates(*)), seller:users(username, first_name)`)
    .is('sold_to', null)
    .gt('expires_at', new Date().toISOString())
    .order('asking_price', { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (error || !listings || listings.length === 0) {
    const kb = new InlineKeyboard().text('⬅️ К салонам', cb.dealers())
    await ctx.editMessageText(
      ['👥 <b>P2P МАРКЕТ</b>', '', 'Сейчас пусто. Будь первым!'].join('\n'),
      { parse_mode: 'HTML', reply_markup: kb }
    )
    return
  }

  const lines = [
    `👥 <b>P2P МАРКЕТ</b>`,
    `Найдено: ${listings.length} предложений`,
    '',
  ]

  for (const l of listings as (MarketListingRow & {
    car: { catalog: CarCatalogRow; plate: { plate_text: string; region: string; rarity: string } | null } | null
    seller: { username: string | null; first_name: string | null } | null
  })[]) {
    if (!l.car || !l.car.catalog) continue
    const sellerName = l.seller?.username ? `@${l.seller.username}` : l.seller?.first_name ?? '?'
    lines.push(`${escapeHtml(l.car.catalog.brand)} ${escapeHtml(l.car.catalog.model)}`)
    lines.push(`   T${l.car.catalog.tier} • ${l.car.catalog.power_hp}л.с. • ${money(l.asking_price)}`)
    lines.push(`   👤 ${escapeHtml(sellerName)}`)
    lines.push('')
  }

  const kb = new InlineKeyboard()
  for (const l of listings as (MarketListingRow & { car: { catalog: CarCatalogRow } | null })[]) {
    if (!l.car) continue
    kb.text(`${l.car.catalog.brand} ${l.car.catalog.model.slice(0, 12)} — ${money(l.asking_price)}`, cb.market_buy(l.id)).row()
  }
  kb.text('⬅️ К салонам', cb.dealers())

  await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getUserBalance(tgId: number) {
  const { data } = await supabase
    .from('users')
    .select('balance_cr')
    .eq('telegram_id', tgId)
    .maybeSingle()
  return data
}

async function getFreeGarageSlots(tgId: number): Promise<number> {
  const { data: user } = await supabase
    .from('users')
    .select('garage_slots')
    .eq('telegram_id', tgId)
    .maybeSingle()
  const { count } = await supabase
    .from('user_cars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', tgId)
  const slotsTotal = user?.garage_slots ?? 3
  return Math.max(0, slotsTotal - (count ?? 0))
}
