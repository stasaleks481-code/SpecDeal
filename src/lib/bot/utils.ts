import { supabase, type UserRow, TIER_LABELS, STAGE_INFO, formatNumber } from '@/lib/supabase'

// ─── User helpers ────────────────────────────────────────────────────

export async function getUser(telegramId: number): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle<UserRow>()
  if (error) {
    console.error('[getUser] error:', error)
    return null
  }
  return data
}

export async function updateBalance(telegramId: number, deltaCr: number, deltaSp: number = 0): Promise<UserRow | null> {
  const user = await getUser(telegramId)
  if (!user) return null

  const newCr = Number(user.balance_cr) + deltaCr
  const newSp = Number(user.balance_sp) + deltaSp

  if (newCr < 0 || newSp < 0) return null

  const { data, error } = await supabase
    .from('users')
    .update({
      balance_cr: newCr,
      balance_sp: newSp,
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_id', telegramId)
    .select('*')
    .maybeSingle<UserRow>()

  if (error) {
    console.error('[updateBalance] error:', error)
    return null
  }
  return data
}

// ─── Formatting helpers ───────────────────────────────────────────────

export function carTitle(car: { catalog: { brand: string; model: string; year: number; tier: number } }): string {
  const t = TIER_LABELS[car.catalog.tier]
  return `${t.emoji} ${escapeHtml(car.catalog.brand)} ${escapeHtml(car.catalog.model)} (${car.catalog.year})`
}

export function conditionBar(pct: number): string {
  const filled = Math.floor(pct / 10)
  const char = pct >= 70 ? '🟩' : pct >= 30 ? '🟨' : '🟥'
  return char.repeat(filled) + '⬛'.repeat(10 - filled)
}

export function money(n: number): string {
  return `$${formatNumber(n)}`
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function plateRarityLabel(rarity: string): string {
  const map: Record<string, string> = {
    common: '⬜ Обычный',
    mirror: '🔵 Зеркалка',
    hundred: '🟢 Сотня',
    triple: '🟡 Тройка',
    elite: '🟣 Блатная',
    legendary: '🔴 ЛЕГЕНДА',
  }
  return map[rarity] ?? rarity
}

// ─── Callback data helpers ───────────────────────────────────────────

export const cb = {
  // Navigation
  menu: () => 'menu:main',
  garage: () => 'garage:view',
  garage_car: (carId: string) => `garage:car:${carId}`,
  garage_set_active: (carId: string) => `garage:active:${carId}`,
  garage_sell: (carId: string) => `garage:sell:${carId}`,

  // Dealerships
  dealers: () => 'dealers:view',
  dealer_open: (dealerId: number, page: number = 0) => `dealer:open:${dealerId}:${page}`,
  dealer_buy: (invId: number) => `dealer:buy:${invId}`,
  dealer_buy_confirm: (invId: number) => `dealer:buyconfirm:${invId}`,
  market: () => 'market:view',
  market_buy: (listingId: string) => `market:buy:${listingId}`,

  // Workshop
  workshop: () => 'workshop:view',
  ws_car: (carId: string) => `ws:car:${carId}`,
  ws_repair: (carId: string, part: string) => `ws:repair:${carId}:${part}`,
  ws_repair_all: (carId: string) => `ws:repairall:${carId}`,
  ws_repair_all_confirm: (carId: string) => `ws:repairallconfirm:${carId}`,
  ws_stage: (carId: string) => `ws:stage:${carId}`,
  ws_stage_confirm: (carId: string) => `ws:stageconfirm:${carId}`,

  // Plates
  plates: () => 'plates:view',
  plates_spin: () => 'plates:spin',
  plates_spin_confirm: () => 'plates:spinconfirm',
  plates_attach: (plateId: string) => `plates:attach:${plateId}`,
  plates_attach_to: (plateId: string, carId: string) => `plates:attachto:${plateId}:${carId}`,

  // Bank
  bank: () => 'bank:view',
  bank_deposit_10k: () => 'bank:dep:10000',
  bank_deposit_50k: () => 'bank:dep:50000',
  bank_deposit_100k: () => 'bank:dep:100000',
  bank_withdraw_10k: () => 'bank:wd:10000',
  bank_withdraw_all: () => 'bank:wd:all',
  bank_loan_50k: () => 'bank:loan:50000',
  bank_loan_payoff: () => 'bank:loanpayoff',

  // Races
  races: () => 'races:view',
  race_drag: (bet: number) => `race:drag:${bet}`,
  race_drag_npc: (bet: number) => `race:dragnpc:${bet}`,

  // Cases
  cases: () => 'cases:view',
  case_open: (caseCode: string) => `case:open:${caseCode}`,
  case_open_confirm: (caseCode: string) => `case:openconfirm:${caseCode}`,

  // Profile
  profile: () => 'profile:view',
  leaderboard: () => 'leaderboard:view',

  // Generic
  back: (target: string) => `back:${target}`,
  cancel: () => 'cancel',
  noop: () => 'noop',
} as const

export function parseCallback(data: string): { section: string; action: string; args: string[] } {
  const parts = data.split(':')
  return {
    section: parts[0] ?? '',
    action: parts[1] ?? '',
    args: parts.slice(2),
  }
}
