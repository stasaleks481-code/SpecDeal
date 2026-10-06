import { createClient } from '@supabase/supabase-js'

/**
 * Client-safe Supabase client.
 *
 * IMPORTANT: Use process.env.NEXT_PUBLIC_* directly (NOT a wrapper function).
 * Next.js statically analyzes process.env.* references at build time
 * and inlines the values. A wrapper function like getEnv('VAR_NAME')
 * would break this static analysis and env vars wouldn't be inlined
 * into the client bundle.
 *
 * Also: do NOT import env.ts here — it contains server-only vars
 * (TELEGRAM_BOT_TOKEN) which would leak into the client bundle.
 */

// These will be replaced with their string values at build time.
// Fallback to empty string for safety (will throw at runtime if missing).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  // Throw a clear error rather than letting supabase-js fail mysteriously.
  // This is caught by the client's error boundary and shown as "Auth failed".
  throw new Error(
    `[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ` +
    `Check Vercel Project Settings → Environment Variables.`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Type definitions ────────────────────────────────────────────────

export type AccountType = 'anonymous' | 'telegram' | 'steam'

export interface TelegramLinkData {
  id: number
  username: string | null
  first_name: string
  last_name: string | null
  photo_url: string | null
}

export interface UserRow {
  id: number
  username: string | null
  first_name: string
  last_name: string | null
  photo_url: string | null
  language_code: string | null
  steam_id: string | null
  steam_data: Record<string, unknown> | null
  steam_linked_at: string | null
  /** 'anonymous' — limited profile; 'telegram' — TG primary; 'steam' — Steam primary */
  account_type: AccountType
  /** Steam-primary users: snapshot of the linked Telegram profile */
  tg_link_data: TelegramLinkData | null
  /** Steam-primary users: show the linked TG profile to other users? */
  show_tg_profile: boolean
  /** Onboarding tour completed */
  onboarding_done: boolean
  trust_score: number
  reviews_count: number
  matches_count: number
  theme_color: ThemeColor
  is_online: boolean
  last_seen_at: string
  badges: string[]
  created_at: string
  updated_at: string
}

export type RoomCategory = 'game' | 'casual' | 'party'
export type SkillLevel = 'casual' | 'mid' | 'hardcore'

export interface RoomRow {
  id: string
  host_id: number
  category: RoomCategory
  game_name: string | null
  game_format: string | null
  play_style: string | null
  topic_tags: string[]
  /** PC LFG only: 'casual' | 'mid' | 'hardcore' */
  skill_level: SkillLevel | null
  /** Party rooms: 'spyfall' | 'mafia' | 'bunker' | 'whoami' */
  game_type: string | null
  /** Party rooms: { auto_mute: boolean } */
  game_settings: { auto_mute?: boolean } | null
  title: string
  description: string | null
  max_players: number
  is_private: boolean
  is_active: boolean
  voice_enabled: boolean
  created_at: string
  closed_at: string | null
}

/** Server-authoritative party game session (sanitized per-user by the API) */
export interface GameSessionRow {
  id: string
  room_id: string
  game_type: string
  phase: 'playing' | 'finished'
  state: Record<string, unknown>
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface RoomMemberRow {
  room_id: string
  user_id: number
  joined_at: string
  is_ready: boolean
}

export interface DirectMessageRow {
  id: number
  sender_id: number
  receiver_id: number
  content: string
  read_at: string | null
  created_at: string
}

export interface FriendRow {
  id: string
  user_id_1: number
  user_id_2: number
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  accepted_at: string | null
}

export interface ReviewRow {
  id: string
  from_user_id: number
  to_user_id: number
  rating_type: 'friendly' | 'good_aim' | 'captain' | 'toxic' | 'leaver' | 'good_chat'
  comment: string | null
  room_id: string | null
  created_at: string
}

// ─── Static game data ───────────────────────────────────────────────
// banner sources:
//  - Steam games: official library_600x900 art from Steam CDN
//  - Non-Steam games (valorant, fortnite): self-hosted in /public/games

export interface GameDef {
  code: string
  name: string
  fullName: string
  color: string
  gradient: string
  formats: string[]
  steamAppId: number | null
  banner: string | null
  /** Cooperative PvE game (affects format labels) */
  coop?: boolean
  /** Russian aliases for search autocomplete */
  ru?: string[]
}

const steamBanner = (appId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`

export const GAMES: GameDef[] = [
  // ── Competitive shooters / MOBA ──
  {
    code: 'cs2',
    name: 'CS2',
    fullName: 'Counter-Strike 2',
    color: '#F7A600',
    gradient: 'linear-gradient(135deg, #F7A600 0%, #D4880A 100%)',
    formats: ['2x2', '3x3', '5x5', 'duo'],
    steamAppId: 730,
    banner: steamBanner(730),
    ru: ['кс', 'кс2', 'контра', 'стрелялка'],
  },
  {
    code: 'dota2',
    name: 'Dota 2',
    fullName: 'Dota 2',
    color: '#C0392B',
    gradient: 'linear-gradient(135deg, #C0392B 0%, #7B241C 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 570,
    banner: steamBanner(570),
    ru: ['дота', 'дота2', 'моба'],
  },
  {
    code: 'deadlock',
    name: 'Deadlock',
    fullName: 'Deadlock',
    color: '#8B0000',
    gradient: 'linear-gradient(135deg, #8B0000 0%, #4A0000 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 1422450,
    banner: steamBanner(1422450),
    ru: ['дедлок'],
  },
  {
    code: 'valorant',
    name: 'VALORANT',
    fullName: 'Valorant',
    color: '#FF4655',
    gradient: 'linear-gradient(135deg, #FF4655 0%, #BD3944 100%)',
    formats: ['2x2', '5x5', 'duo'],
    steamAppId: null,
    banner: '/games/valorant.jpg',
    ru: ['валорант', 'вало'],
  },
  {
    code: 'apex',
    name: 'Apex Legends',
    fullName: 'Apex Legends',
    color: '#DA3030',
    gradient: 'linear-gradient(135deg, #DA3030 0%, #8C1F1F 100%)',
    formats: ['duo', '3x3'],
    steamAppId: 1172470,
    banner: steamBanner(1172470),
    ru: ['апекс', 'апex'],
  },
  {
    code: 'marvel_rivals',
    name: 'Marvel Rivals',
    fullName: 'Marvel Rivals',
    color: '#E62429',
    gradient: 'linear-gradient(135deg, #E62429 0%, #8B0000 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 2767030,
    banner: steamBanner(2767030),
    ru: ['марвел', 'ривалс'],
  },
  {
    code: 'rust',
    name: 'Rust',
    fullName: 'Rust',
    color: '#C16850',
    gradient: 'linear-gradient(135deg, #C16850 0%, #83452F 100%)',
    formats: ['3x3', '5x5'],
    steamAppId: 252490,
    banner: steamBanner(252490),
    ru: ['раст', 'рафт'],
  },
  {
    code: 'pubg',
    name: 'PUBG',
    fullName: 'PUBG: Battlegrounds',
    color: '#F5A623',
    gradient: 'linear-gradient(135deg, #F5A623 0%, #B87D0A 100%)',
    formats: ['duo', '3x3', '5x5'],
    steamAppId: 578080,
    banner: steamBanner(578080),
    ru: ['пабг', 'батлграунд'],
  },
  {
    code: 'warframe',
    name: 'Warframe',
    fullName: 'Warframe',
    color: '#0099CC',
    gradient: 'linear-gradient(135deg, #0099CC 0%, #005577 100%)',
    formats: ['3x3', '5x5'],
    steamAppId: 230410,
    banner: steamBanner(230410),
    ru: ['варфрейм'],
  },
  {
    code: 'overwatch2',
    name: 'Overwatch 2',
    fullName: 'Overwatch 2',
    color: '#F99E1A',
    gradient: 'linear-gradient(135deg, #F99E1A 0%, #B86E0A 100%)',
    formats: ['3x3', '5x5', 'duo'],
    // FIX: Overwatch 2 IS on Steam since Aug 2023 — appid 2357570
    steamAppId: 2357570,
    banner: steamBanner(2357570),
    ru: ['овервотч', 'ов2', 'овервотч'],
  },
  {
    code: 'fortnite',
    name: 'Fortnite',
    fullName: 'Fortnite',
    color: '#00B4D8',
    gradient: 'linear-gradient(135deg, #00B4D8 0%, #007088 100%)',
    formats: ['duo', '3x3', '5x5'],
    steamAppId: null,
    banner: '/games/fortnite.jpg',
    ru: ['фортнайт', 'фортик'],
  },
  {
    code: 'human_fall_flat',
    name: 'Human Fall Flat',
    fullName: 'Human Fall Flat',
    color: '#9B59B6',
    gradient: 'linear-gradient(135deg, #9B59B6 0%, #6C3483 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 477160,
    banner: steamBanner(477160),
    ru: ['человечек', 'хаман фол флат'],
  },

  // ── Co-op classics (added) ──
  {
    code: 'helldivers2',
    name: 'Helldivers 2',
    fullName: 'Helldivers 2',
    color: '#FFE600',
    gradient: 'linear-gradient(135deg, #FFE600 0%, #B89D00 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 553850,
    banner: steamBanner(553850),
    ru: ['хелдайверы', 'адовые псы', 'хеллдайверс'],
  },
  {
    code: 'it_takes_two',
    name: 'It Takes Two',
    fullName: 'It Takes Two',
    color: '#E8C547',
    gradient: 'linear-gradient(135deg, #E8C547 0%, #A3852B 100%)',
    formats: ['duo'],
    coop: true,
    steamAppId: 1426210,
    banner: steamBanner(1426210),
    ru: ['двое', 'на двоих', 'ит тейкс ту'],
  },
  {
    code: 'l4d2',
    name: 'Left 4 Dead 2',
    fullName: 'Left 4 Dead 2',
    color: '#7D8B4C',
    gradient: 'linear-gradient(135deg, #7D8B4C 0%, #4A5430 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 550,
    banner: steamBanner(550),
    ru: ['л4д', 'лефт 4 дед', 'выжившие'],
  },
  {
    code: 'phasmophobia',
    name: 'Phasmophobia',
    fullName: 'Phasmophobia',
    color: '#4EE1A0',
    gradient: 'linear-gradient(135deg, #4EE1A0 0%, #1F6B4A 100%)',
    formats: ['duo', 'trio', 'squad'],
    coop: true,
    steamAppId: 739630,
    banner: steamBanner(739630),
    ru: ['фазмофобия', 'фазмо', 'призраки'],
  },
  {
    code: 'lethal_company',
    name: 'Lethal Company',
    fullName: 'Lethal Company',
    color: '#C4A35A',
    gradient: 'linear-gradient(135deg, #C4A35A 0%, #6E5A2C 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 1966720,
    banner: steamBanner(1966720),
    ru: ['летал', 'летальная компания', 'лесал'],
  },
  {
    code: 'terraria',
    name: 'Terraria',
    fullName: 'Terraria',
    color: '#5AA9E6',
    gradient: 'linear-gradient(135deg, #5AA9E6 0%, #2D6A9F 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 105600,
    banner: steamBanner(105600),
    ru: ['террария', 'терка'],
  },
  {
    code: 'valheim',
    name: 'Valheim',
    fullName: 'Valheim',
    color: '#6ED3C7',
    gradient: 'linear-gradient(135deg, #6ED3C7 0%, #2E7D74 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 892970,
    banner: steamBanner(892970),
    ru: ['вальхейм', 'викинги'],
  },
  {
    code: 'portal2',
    name: 'Portal 2',
    fullName: 'Portal 2',
    color: '#5B8DEF',
    gradient: 'linear-gradient(135deg, #5B8DEF 0%, #2D4FA1 100%)',
    formats: ['duo'],
    coop: true,
    steamAppId: 620,
    banner: steamBanner(620),
    ru: ['портал', 'портал 2', 'глэдос'],
  },
  {
    code: 'deep_rock',
    name: 'Deep Rock Galactic',
    fullName: 'Deep Rock Galactic',
    color: '#FFA51F',
    gradient: 'linear-gradient(135deg, #FFA51F 0%, #9C5E00 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 548430,
    banner: steamBanner(548430),
    ru: ['дип рок', 'гномы', 'дипрок'],
  },
  {
    code: 'stardew_valley',
    name: 'Stardew Valley',
    fullName: 'Stardew Valley',
    color: '#63C74D',
    gradient: 'linear-gradient(135deg, #63C74D 0%, #2E7D32 100%)',
    formats: ['duo', 'trio', 'squad', 'full'],
    coop: true,
    steamAppId: 413150,
    banner: steamBanner(413150),
    ru: ['стардью', 'долина звёзд', 'ферма'],
  },
]

// Search helper for autocomplete (name + fullName + RU aliases, case-insensitive)
export function searchGames(query: string): GameDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return GAMES
  return GAMES.filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.fullName.toLowerCase().includes(q) ||
      (g.ru ?? []).some((a) => a.includes(q))
  )
}

// ─── Party games (Table Games section) ──────────────────────────────

export interface PartyGameDef {
  code: 'spyfall' | 'mafia' | 'bunker' | 'whoami'
  name: string
  emoji: string
  desc: string
  color: string
  gradient: string
  minPlayers: number
  /** Turn timer in seconds (0 = no timer) */
  turnSeconds: number
}

export const PARTY_GAMES: PartyGameDef[] = [
  {
    code: 'spyfall',
    name: 'Шпион',
    emoji: '🕵️',
    desc: 'Все на одной локации. Один — Шпион. Задавай вопросы и вычисли его!',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #4C1D95 100%)',
    minPlayers: 3,
    turnSeconds: 0,
  },
  {
    code: 'mafia',
    name: 'Мафия',
    emoji: '🎭',
    desc: 'Город засыпает. Мафия просыпается. Найди мафию до того, как она найдёт тебя.',
    color: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
    minPlayers: 4,
    turnSeconds: 0,
  },
  {
    code: 'bunker',
    name: 'Бункер',
    emoji: '🏛️',
    desc: 'Катастрофа. Бункер вмещает не всех. Убеди, что выжить должен именно ты.',
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #78350F 100%)',
    minPlayers: 3,
    turnSeconds: 30,
  },
  {
    code: 'whoami',
    name: 'Кто я?',
    emoji: '❓',
    desc: 'Слово на лбу видно всем, кроме тебя. Задавай вопросы и угадай, кто ты.',
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0C4A6E 100%)',
    minPlayers: 3,
    turnSeconds: 60,
  },
]

export function partyGame(code: string | null | undefined): PartyGameDef | null {
  if (!code) return null
  return PARTY_GAMES.find((g) => g.code === code) ?? null
}

// ─── Skill levels (PC LFG) ──────────────────────────────────────────

export const SKILL_LEVELS = {
  casual:   { label: 'Casual / For Fun', short: 'Casual',   color: '#4EE1A0', emoji: '🌿', desc: 'Играем ради фанa, без напряжения' },
  mid:      { label: 'Mid / Ranked',     short: 'Mid',      color: '#F7A600', emoji: '⚔️', desc: 'Обычный уровень, ранкед-матчи' },
  hardcore: { label: 'Hardcore / Pro',   short: 'Hardcore', color: '#FF4655', emoji: '🔥', desc: 'Только серьёзная игра, про-уровень' },
} as const

export function skillLevel(code: string | null | undefined) {
  if (!code) return null
  return (SKILL_LEVELS as Record<string, unknown>)[code] ?? null
}

// Format labels (RU)
export const FORMAT_LABELS: Record<string, string> = {
  '2x2': '2×2',
  '3x3': '3×3',
  '5x5': '5×5',
  duo: 'Дуо',
  trio: 'Трио',
  squad: 'Отряд',
  full: 'Полный состав',
}

// Legacy casual topics (kept for old rooms display; no longer selectable at creation)
export const CASUAL_TOPICS = [
  { code: 'talk',     label: 'Поговорить по душам', emoji: '💬' },
  { code: 'cinema',   label: 'Обсудить кино',       emoji: '🎬' },
  { code: 'night',    label: 'Ночной разговор',     emoji: '🌙' },
  { code: 'music',    label: 'Музыка',              emoji: '🎵' },
  { code: 'games',    label: 'Игры вобще',           emoji: '🎮' },
  { code: 'tech',     label: 'Технологии',          emoji: '⚡' },
] as const

export const REVIEW_TYPES = {
  friendly:  { label: 'Приятный соигрок', emoji: '👍', score: 2 },
  good_aim:   { label: 'Хороший аим',      emoji: '🎯', score: 1 },
  captain:    { label: 'Капитан',          emoji: '🎖️', score: 2 },
  good_chat:  { label: 'Хороший собеседник', emoji: '🗣️', score: 2 },
  toxic:      { label: 'Токсик',           emoji: '🤬', score: -3 },
  leaver:     { label: 'Слил катку',       emoji: '💀', score: -2 },
} as const

// ─── Themes ─────────────────────────────────────────────────────────
// 'steam' — Classic Steam style: dark graphite/blue, neon glow preserved

export const THEME_COLORS = {
  cyan:  { primary: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)',  name: 'Neon Cyan' },
  pink:  { primary: '#ff3ec9', glow: 'rgba(255, 62, 201, 0.4)', name: 'Neon Pink' },
  green: { primary: '#39ff14', glow: 'rgba(57, 255, 20, 0.4)',  name: 'Cyber Green' },
  amber: { primary: '#ffb627', glow: 'rgba(255, 182, 39, 0.4)', name: 'Amber Glow' },
  steam: { primary: '#66c0f4', glow: 'rgba(102, 192, 244, 0.4)', name: 'Steam Classic' },
} as const

export type ThemeColor = keyof typeof THEME_COLORS
