import 'server-only'
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { env } from '@/config/env'

/**
 * Admin authentication — server-only.
 *
 * Password is stored as a scrypt hash in the `app_config` table
 * (key 'admin_password_hash'). An optional ADMIN_PASSWORD env var
 * overrides the DB hash when set.
 *
 * Session = HMAC-SHA256 signed token in an httpOnly cookie.
 * The signing secret is derived from the Telegram bot token
 * (server-only variable, never exposed to the client).
 */

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>

export const ADMIN_COOKIE = 'vd_admin'
/** Session lifetime: 12 hours */
export const ADMIN_SESSION_TTL_S = 12 * 60 * 60

/* ── Password verification ─────────────────────────────────────────── */

async function verifyScryptHash(password: string, stored: string): Promise<boolean> {
  // Format: scrypt$N$saltHex$hashHex
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false
  const N = parseInt(parts[1], 10)
  const salt = Buffer.from(parts[2], 'hex')
  const expected = Buffer.from(parts[3], 'hex')
  const derived = await scrypt(password, salt, expected.length, { N, r: 8, p: 1 })
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false

  // 1. Env override (if the owner sets ADMIN_PASSWORD in Vercel env)
  const envPassword = process.env.ADMIN_PASSWORD
  if (envPassword) {
    return constantTimeEqual(password, envPassword)
  }

  // 2. Hash stored in app_config
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'admin_password_hash')
    .maybeSingle<{ value: string }>()

  if (!data?.value) return false
  return verifyScryptHash(password, data.value)
}

/* ── Session token ─────────────────────────────────────────────────── */

function sign(payload: string): string {
  return createHmac('sha256', env.telegramBotToken).update(payload).digest('base64url')
}

export function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Date.now() + ADMIN_SESSION_TTL_S * 1000 })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length) return false
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { role?: string; exp?: number }
    return data.role === 'admin' && typeof data.exp === 'number' && data.exp > Date.now()
  } catch {
    return false
  }
}

/* ── Request guards ────────────────────────────────────────────────── */

/** Guard for /api/admin/* routes. Returns a 401 response if not admin. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const token =
    req.cookies.get(ADMIN_COOKIE)?.value ??
    req.headers.get('x-admin-token')
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** Convenience: read the admin cookie inside Server Components / route handlers */
export async function hasAdminCookie(): Promise<boolean> {
  const store = await cookies()
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value)
}

/** Generate a fresh CSRF-ish nonce (not used in stateless flow, kept for parity) */
export function nonce(): string {
  return randomBytes(16).toString('hex')
}
