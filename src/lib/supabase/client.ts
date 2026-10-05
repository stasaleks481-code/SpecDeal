import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

/**
 * Server-side Supabase client (uses anon key + RLS).
 * For TMA logic that runs server-side (API routes), this is sufficient.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
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

// ─── Helpers ────────────────────────────────────────────────────────

export const THEME_COLORS = {
  cyan:  { primary: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)',  name: 'Neon Cyan' },
  pink:  { primary: '#ff3ec9', glow: 'rgba(255, 62, 201, 0.4)', name: 'Neon Pink' },
  green: { primary: '#39ff14', glow: 'rgba(57, 255, 20, 0.4)',  name: 'Cyber Green' },
  amber: { primary: '#ffb627', glow: 'rgba(255, 182, 39, 0.4)', name: 'Amber Glow' },
} as const

export type ThemeColor = keyof typeof THEME_COLORS

export const GAMES = [
  { code: 'cs2',          name: 'CS2',            emoji: '🔫', color: '#f5a623', formats: ['2x2', '3x3', '5x5', 'duo'] },
  { code: 'dota2',        name: 'Dota 2',         emoji: '🛡️', color: '#c0392b', formats: ['3x3', '5x5', 'duo'] },
  { code: 'roblox',       name: 'Roblox',         emoji: '🟦', color: '#3498db', formats: ['duo', '3x3', '5x5'] },
  { code: 'valorant',     name: 'Valorant',       emoji: '🎯', color: '#ff4655', formats: ['2x2', '5x5', 'duo'] },
  { code: 'apex',         name: 'Apex Legends',   emoji: '⚔️', color: '#da3030', formats: ['duo', '3x3'] },
  { code: 'rust',         name: 'Rust',           emoji: '🔨', color: '#c16850', formats: ['3x3', '5x5'] },
  { code: 'human_fall_flat', name: 'Human Fall Flat', emoji: '🤸', color: '#9b59b6', formats: ['duo', '3x3', '5x5'] },
  { code: 'minecraft',    name: 'Minecraft',      emoji: '⛏️', color: '#3fb950', formats: ['duo', '3x3', '5x5'] },
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
