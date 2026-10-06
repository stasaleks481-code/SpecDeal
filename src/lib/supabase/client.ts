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
  trust_score: number
  reviews_count: number
  matches_count: number
  theme_color: 'cyan' | 'pink' | 'green' | 'amber'
  is_online: boolean
  last_seen_at: string
  badges: string[]
  created_at: string
  updated_at: string
}

export interface RoomRow {
  id: string
  host_id: number
  category: 'game' | 'casual'
  game_name: string | null
  game_format: string | null
  play_style: string | null
  topic_tags: string[]
  title: string
  description: string | null
  max_players: number
  is_private: boolean
  is_active: boolean
  voice_enabled: boolean
  created_at: string
  closed_at: string | null
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

export const THEME_COLORS = {
  cyan:  { primary: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)',  name: 'Neon Cyan' },
  pink:  { primary: '#ff3ec9', glow: 'rgba(255, 62, 201, 0.4)', name: 'Neon Pink' },
  green: { primary: '#39ff14', glow: 'rgba(57, 255, 20, 0.4)',  name: 'Cyber Green' },
  amber: { primary: '#ffb627', glow: 'rgba(255, 182, 39, 0.4)', name: 'Amber Glow' },
} as const

export type ThemeColor = keyof typeof THEME_COLORS

export const GAMES = [
  {
    code: 'cs2',
    name: 'CS2',
    fullName: 'Counter-Strike 2',
    color: '#F7A600',
    gradient: 'linear-gradient(135deg, #F7A600 0%, #D4880A 100%)',
    formats: ['2x2', '3x3', '5x5', 'duo'],
    steamAppId: 730,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/730/library_600x900_2x.jpg',
  },
  {
    code: 'dota2',
    name: 'Dota 2',
    fullName: 'Dota 2',
    color: '#C0392B',
    gradient: 'linear-gradient(135deg, #C0392B 0%, #7B241C 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 570,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/570/library_600x900_2x.jpg',
  },
  {
    code: 'deadlock',
    name: 'Deadlock',
    fullName: 'Deadlock',
    color: '#8B0000',
    gradient: 'linear-gradient(135deg, #8B0000 0%, #4A0000 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 1422450,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1422450/library_600x900_2x.jpg',
  },
  {
    code: 'valorant',
    name: 'VALORANT',
    fullName: 'Valorant',
    color: '#FF4655',
    gradient: 'linear-gradient(135deg, #FF4655 0%, #BD3944 100%)',
    formats: ['2x2', '5x5', 'duo'],
    steamAppId: null,
    banner: null,
  },
  {
    code: 'apex',
    name: 'Apex Legends',
    fullName: 'Apex Legends',
    color: '#DA3030',
    gradient: 'linear-gradient(135deg, #DA3030 0%, #8C1F1F 100%)',
    formats: ['duo', '3x3'],
    steamAppId: 1172470,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/library_600x900_2x.jpg',
  },
  {
    code: 'marvel_rivals',
    name: 'Marvel Rivals',
    fullName: 'Marvel Rivals',
    color: '#E62429',
    gradient: 'linear-gradient(135deg, #E62429 0%, #8B0000 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: 2767030,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2767030/library_600x900_2x.jpg',
  },
  {
    code: 'rust',
    name: 'Rust',
    fullName: 'Rust',
    color: '#C16850',
    gradient: 'linear-gradient(135deg, #C16850 0%, #83452F 100%)',
    formats: ['3x3', '5x5'],
    steamAppId: 252490,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/252490/library_600x900_2x.jpg',
  },
  {
    code: 'human_fall_flat',
    name: 'Human Fall Flat',
    fullName: 'Human Fall Flat',
    color: '#9B59B6',
    gradient: 'linear-gradient(135deg, #9B59B6 0%, #6C3483 100%)',
    formats: ['duo', '3x3', '5x5'],
    steamAppId: 477160,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/477160/library_600x900_2x.jpg',
  },
  {
    code: 'pubg',
    name: 'PUBG',
    fullName: 'PUBG: Battlegrounds',
    color: '#F5A623',
    gradient: 'linear-gradient(135deg, #F5A623 0%, #B87D0A 100%)',
    formats: ['duo', '3x3', '5x5'],
    steamAppId: 578080,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/578080/library_600x900_2x.jpg',
  },
  {
    code: 'warframe',
    name: 'Warframe',
    fullName: 'Warframe',
    color: '#0099CC',
    gradient: 'linear-gradient(135deg, #0099CC 0%, #005577 100%)',
    formats: ['3x3', '5x5'],
    steamAppId: 230410,
    banner: 'https://cdn.cloudflare.steamstatic.com/steam/apps/230410/library_600x900_2x.jpg',
  },
  {
    code: 'overwatch2',
    name: 'Overwatch 2',
    fullName: 'Overwatch 2',
    color: '#F99E1A',
    gradient: 'linear-gradient(135deg, #F99E1A 0%, #B86E0A 100%)',
    formats: ['3x3', '5x5', 'duo'],
    steamAppId: null,
    banner: null,
  },
  {
    code: 'fortnite',
    name: 'Fortnite',
    fullName: 'Fortnite',
    color: '#00B4D8',
    gradient: 'linear-gradient(135deg, #00B4D8 0%, #007088 100%)',
    formats: ['duo', '3x3', '5x5'],
    steamAppId: null,
    banner: null,
  },
] as const

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
