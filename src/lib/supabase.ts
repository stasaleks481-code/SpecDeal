import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

/**
 * Server-side Supabase client (uses anon key + RLS).
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// ─── Types ────────────────────────────────────────────────────────────

export interface UserRow {
  id: string
  telegram_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  balance_cr: number
  balance_sp: number
  bank_deposit: number
  bank_loan: number
  bank_loan_due_at: string | null
  level: number
  xp: number
  reputation: number
  garage_slots: number
  successful_deals: number
  races_won: number
  races_total: number
  is_banned: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
}

export const NEW_USER_DEFAULTS = {
  balance_cr: 50_000,
  balance_sp: 0,
  level: 1,
  reputation: 0,
  successful_deals: 0,
  races_won: 0,
  races_total: 0,
  garage_slots: 3,
} as const

export interface CarCatalogRow {
  id: number
  tier: number
  brand: string
  model: string
  year: number
  base_price: number
  power_hp: number
  weight_kg: number
  layout: 'FWD' | 'RWD' | 'AWD'
  engine: string
  is_jdm: boolean
  image_url: string | null
}

export interface UserCarRow {
  id: string
  user_id: number
  catalog_id: number
  body_cond: number
  engine_cond: number
  suspension_cond: number
  interior_cond: number
  stage_level: number
  engine_swap: string | null
  has_lsd: boolean
  has_welded_diff: boolean
  plate_id: string | null
  nickname: string | null
  is_active: boolean
  is_listed: boolean
  purchase_price: number
  purchase_source: string
  mileage_km: number
  created_at: string
  updated_at: string
}

export interface LicensePlateRow {
  id: string
  user_id: number
  car_id: string | null
  plate_text: string
  region: string
  rarity: 'common' | 'mirror' | 'hundred' | 'triple' | 'elite' | 'legendary'
  price_modifier: number
  is_assigned: boolean
  is_listed: boolean
  listed_price: number | null
  created_at: string
}

export interface DealershipRow {
  id: number
  type: 'state' | 'private'
  name: string
  owner_id: number | null
  tier_min: number
  tier_max: number
  markup_pct: number
  fee_pct: number
  created_at: string
}

export interface DealershipInventoryRow {
  id: number
  dealership_id: number
  catalog_id: number
  condition: number
  price: number
  stock: number
  restock_at: string | null
  created_at: string
}

export interface MarketListingRow {
  id: string
  seller_id: number
  car_id: string
  asking_price: number
  listed_at: string
  expires_at: string
  sold_to: number | null
  sold_at: string | null
  sold_price: number | null
}

export interface CaseRow {
  id: number
  code: string
  name: string
  description: string
  price_cr: number | null
  price_sp: number | null
  icon: string
}

export interface AchievementRow {
  id: number
  code: string
  title: string
  description: string
  icon: string
  reward_cr: number
  reward_sp: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export interface RaceRow {
  id: string
  race_type: 'drag' | 'ring' | 'drift'
  distance_m: number
  player1_id: number
  player2_id: number | null
  player1_car_id: string
  player2_car_id: string | null
  player1_perf: number | null
  player2_perf: number | null
  winner_id: number
  bet_amount: number
  log: Record<string, unknown> | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Tier color for UI display */
export const TIER_LABELS: Record<number, { name: string; color: string; emoji: string }> = {
  1: { name: 'Утиль и Автохлам',     color: '🟫', emoji: '🚗' },
  2: { name: 'Городской Сток',       color: '🟦', emoji: '🚙' },
  3: { name: 'Уличный Тюнинг',      color: '🟪', emoji: '🏎' },
  4: { name: 'Заряженный Премиум', color: '🟨', emoji: '🔥' },
  5: { name: 'Суперкары',           color: '🟥', emoji: '💎' },
  6: { name: 'Гиперкары',           color: '⬛', emoji: '👑' },
}

/** Plate rarity metadata */
export const PLATE_RARITY: Record<string, { label: string; modifier: number; chance: number; emoji: string }> = {
  common:     { label: 'Обычный',      modifier: 1.00, chance: 0.70, emoji: '⬜' },
  mirror:     { label: 'Зеркалка',     modifier: 1.15, chance: 0.18, emoji: '🟦' },
  hundred:    { label: 'Ровная сотня', modifier: 1.25, chance: 0.07, emoji: '🟩' },
  triple:     { label: 'Тройка',       modifier: 1.50, chance: 0.035, emoji: '🟨' },
  elite:      { label: 'Блатная серия', modifier: 1.80, chance: 0.012, emoji: '🟪' },
  legendary:  { label: 'ЛЕГЕНДА',      modifier: 2.20, chance: 0.003, emoji: '🟥' },
}

/** Stage tuning metadata */
export const STAGE_INFO: Record<number, { name: string; power_mult: number; price_mult: number }> = {
  0: { name: 'Сток',     power_mult: 1.00, price_mult: 0.00 },
  1: { name: 'Stage 1',  power_mult: 1.15, price_mult: 0.10 },
  2: { name: 'Stage 2',  power_mult: 1.35, price_mult: 0.25 },
  3: { name: 'Stage 3',  power_mult: 1.70, price_mult: 0.50 },
}

/** Calculate performance index for races (drag formula from spec) */
export function calcPerfIndex(
  power: number,
  weight: number,
  stageLevel: number,
  engineCond: number,
  suspensionCond: number,
  hasLsd: boolean,
): number {
  const stageMult = STAGE_INFO[stageLevel]?.power_mult ?? 1
  const lsdBonus = hasLsd ? 1.05 : 1
  const condFactor = (engineCond + suspensionCond) / 200
  const rng = 0.92 + Math.random() * 0.16  // ±8% RNG
  return (power * stageMult * lsdBonus / weight) * condFactor * rng * 1000
}

/** Calculate sell price to NPC (per spec formulas) */
export function calcNpcSellPrice(
  basePrice: number,
  stageLevel: number,
  plateModifier: number,
): number {
  const stock = basePrice * 1.25
  const stageBonus = basePrice * (STAGE_INFO[stageLevel]?.price_mult ?? 0) * 0.7  // 70% of stage cost recoup on NPC sale
  return (stock + stageBonus) * plateModifier
}

/** Format number with thousands separator */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}
