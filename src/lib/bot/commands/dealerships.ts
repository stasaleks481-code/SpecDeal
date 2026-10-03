import type { Context } from 'grammy'
import { supabase, type DealershipRow, type DealershipInventoryRow, type CarCatalogRow, TIER_LABELS, formatNumber } from '@/lib/supabase'
import { escapeHtml } from '@/lib/bot/menus/main'

/**
 * 🏬 Автосалоны — choose between state (NPC) dealerships or private P2P market.
 */
export async function handleDealerships(ctx: Context): Promise<void> {
  if (!ctx.from) return

  // Make sure user is registered
  const { data: user } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('telegram_id', ctx.from.id)
    .maybeSingle()

  if (!user) {
    await ctx.reply('⚠️ Профиль не найден. Нажми /start чтобы зарегистрироваться.')
    return
  }

  // Count active market listings
  const { count: marketCount } = await supabase
    .from('market_listings')
    .select('id', { count: 'exact', head: true })
    .is('sold_to', null)

  // Count active private dealerships
  const { count: privateDealersCount } = await supabase
    .from('dealerships')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'private')

  const text = [
    '━━━━━━ 🏬 АВТОСАЛОНЫ ━━━━━━',
    '',
    '🚗 <b>Государственные салоны</b>',
    '   Машины от NPC. Цена = MSRP ± 5% (динамика спроса).',
    '   Подходят для новичков — стабильный ассортимент.',
    '',
    '👥 <b>Частные салоны (P2P)</b>',
    '   Игроки сами выставляют тачки на продажу.',
    `   Сейчас активно: <b>${marketCount ?? 0}</b> предложений на маркете`,
    `   Частных автосалонов открыто: <b>${privateDealersCount ?? 0}</b>`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '👇 Выбери тип салона (текстом):',
    '',
    '<code>свалка</code>    — утиль Tier 1 (дёшево, восстанавливать долго)',
    '<code>гос бюджет</code>  — Tier 1-2 (народные тачки)',
    '<code>гос народный</code> — Tier 2-3 (JDM старт)',
    '<code>гос премиум</code> — Tier 4-6 (заряженные)',
    '<code>маркет</code>    — P2P маркет от игроков',
    '<code>мой салон</code>  — открыть свой автосалон ($200k)',
  ].join('\n')

  await ctx.reply(text, { parse_mode: 'HTML' })
}

/**
 * Browse a state dealership's current inventory.
 */
export async function browseStateDealership(ctx: Context, dealershipId: number): Promise<void> {
  if (!ctx.from) return

  // Fetch dealership + its inventory + catalog join
  const { data, error } = await supabase
    .from('dealerships')
    .select(`
      *,
      inventory:dealership_inventory!inner(
        *,
        catalog:cars_catalog(*)
      )
    `)
    .eq('id', dealershipId)
    .maybeSingle<DealershipRow & { inventory: (DealershipInventoryRow & { catalog: CarCatalogRow })[] }>()

  if (error || !data) {
    console.error('[dealership] fetch error:', error)
    await ctx.reply('⚠️ Не удалось загрузить ассортимент салона.')
    return
  }

  const lines = [
    `━━━━━━ 🏬 ${escapeHtml(data.name)} ━━━━━━`,
    '',
    `📊 Ассортимент: <b>${data.inventory.length}</b> моделей`,
    '',
  ]

  if (data.inventory.length === 0) {
    lines.push('🔇 Сейчас пусто. Ждём пополнения...')
  } else {
    for (const item of data.inventory) {
      const tier = TIER_LABELS[item.catalog.tier]
      const condBar = '▓'.repeat(Math.floor(item.condition / 10)) + '░'.repeat(10 - Math.floor(item.condition / 10))
      const jdmTag = item.catalog.is_jdm ? ' 🇯🇵' : ''
      lines.push(
        `${tier.emoji} <b>${escapeHtml(item.catalog.brand)} ${escapeHtml(item.catalog.model)}</b> (${item.catalog.year})${jdmTag}`,
        `   ${tier.color} Tier ${item.catalog.tier} • ${item.catalog.power_hp} Л.С. • ${item.catalog.layout} • ${item.catalog.weight_kg} кг`,
        `   🛠 ${condBar} ${item.condition}%`,
        `   📦 В наличии: <b>${item.stock} шт.</b>`,
        `   💰 Цена: <b>$${formatNumber(item.price)}</b> CR`,
        `   🏷 ID: <code>${item.id}</code>`,
        ''
      )
    }
  }

  lines.push('👇 Чтобы купить (текстом):')
  lines.push('<code>купить <ID></code> — купить машину из салона')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

/**
 * Open a private dealership (player-owned store).
 * For Phase 2 MVP, this is a stub — full feature comes in Phase 3.
 */
export async function browseMarket(ctx: Context): Promise<void> {
  if (!ctx.from) return

  const { data: listings, error } = await supabase
    .from('market_listings')
    .select(`
      *,
      car:user_cars(
        *,
        catalog:cars_catalog(*),
        plate:license_plates(*)
      ),
      seller:users(username, first_name)
    `)
    .is('sold_to', null)
    .gt('expires_at', new Date().toISOString())
    .order('listed_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[market] fetch error:', error)
    await ctx.reply('⚠️ Не удалось загрузить маркет.')
    return
  }

  if (!listings || listings.length === 0) {
    await ctx.reply(
      [
        '━━━━━━ 👥 P2P МАРКЕТ ━━━━━━',
        '',
        '🔇 Сейчас никто ничего не продаёт.',
        '',
        'Будь первым — выстави свою тачку!',
        'Отправь: <code>продать <ID></code> когда в гараже.',
      ].join('\n'),
      { parse_mode: 'HTML' }
    )
    return
  }

  const lines = [
    '━━━━━━ 👥 P2P МАРКЕТ ━━━━━━',
    '',
    `📊 Активно предложений: <b>${listings.length}</b>`,
    '',
  ]

  for (const l of listings) {
    const car = l.car
    if (!car || !car.catalog) continue
    const tier = TIER_LABELS[car.catalog.tier]
    const avgCond = Math.round((car.body_cond + car.engine_cond + car.suspension_cond + car.interior_cond) / 4)
    const stageTag = car.stage_level > 0 ? ` • Stage ${car.stage_level}` : ''
    const swapTag = car.engine_swap ? ` • swap:${car.engine_swap}` : ''
    const plateTag = car.plate ? ` • ${car.plate.plate_text} ${car.plate.region}` : ''
    const sellerName = l.seller?.username ? `@${l.seller.username}` : l.seller?.first_name ?? '?'

    lines.push(
      `${tier.emoji} <b>${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)}</b> (${car.catalog.year})`,
      `   ${tier.color} Tier ${car.catalog.tier} • ${car.catalog.power_hp} Л.С.${stageTag}${swapTag}`,
      `   🛠 ${avgCond}% • 🔢${plateTag}`,
      `   👤 Продавец: ${escapeHtml(sellerName)}`,
      `   💰 Цена: <b>$${formatNumber(l.asking_price)}</b> CR`,
      `   🏷 ID: <code>${l.id.slice(0, 8)}</code>`,
      ''
    )
  }

  lines.push('👇 Чтобы купить (текстом):')
  lines.push('<code>купить маркет <ID></code> — купить с маркета')

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}
