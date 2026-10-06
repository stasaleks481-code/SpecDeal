import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/config/env'

/**
 * Telegram initData validation — used to authenticate TMA users.
 *
 * Telegram passes `initData` as a URL-encoded string in the query/hash
 * of the TMA URL. Format: `param1=val1&param2=val2&hash=<hex>`.
 *
 * Validation algorithm (per Telegram docs):
 * 1. Extract `hash` from the params
 * 2. Build a sorted "data-check-string" of remaining params (key=value\n...)
 * 3. Compute secret_key = HMAC-SHA256("WebAppData", bot_token)
 * 4. Compute hash = HMAC-SHA256(secret_key, data-check-string)
 * 5. Compare with received hash (timing-safe)
 *
 * Also extracts the `user` JSON object for further use.
 */

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
}

export interface ValidatedInitData {
  user: TelegramUser
  auth_date: number
  hash: string
  start_param?: string
}

/**
 * Validate Telegram WebApp initData string.
 * Throws on invalid signature or expired auth_date (>24h old).
 */
export function validateInitData(initData: string): ValidatedInitData {
  if (!initData) {
    throw new Error('initData is empty')
  }

  // Parse URL-encoded params
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    throw new Error('Missing hash in initData')
  }

  const authDateStr = params.get('auth_date')
  if (!authDateStr) {
    throw new Error('Missing auth_date in initData')
  }
  const authDate = parseInt(authDateStr, 10)

  // Check freshness (24h window)
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate
  if (ageSeconds > 86400) {
    throw new Error(`initData expired (age: ${ageSeconds}s, max: 86400s)`)
  }

  // Build data-check-string: sorted params WITHOUT hash, joined by \n
  const sortedKeys = Array.from(params.keys()).filter((k) => k !== 'hash').sort()
  const dataCheckString = sortedKeys
    .map((k) => `${k}=${params.get(k)}`)
    .join('\n')

  // Compute secret_key = HMAC-SHA256("WebAppData", bot_token)
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(env.telegramBotToken)
    .digest()

  // Compute computed_hash = HMAC-SHA256(secret_key, data-check-string)
  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Timing-safe compare
  const hashBuf = Buffer.from(hash, 'hex')
  const computedBuf = Buffer.from(computedHash, 'hex')
  if (hashBuf.length !== computedBuf.length || !timingSafeEqual(hashBuf, computedBuf)) {
    throw new Error('Invalid initData signature')
  }

  // Extract user JSON
  const userStr = params.get('user')
  if (!userStr) {
    throw new Error('Missing user in initData')
  }

  let user: TelegramUser
  try {
    user = JSON.parse(userStr) as TelegramUser
  } catch {
    throw new Error('Invalid user JSON in initData')
  }

  if (!user.id || !user.first_name) {
    throw new Error('Invalid user object')
  }

  return {
    user,
    auth_date: authDate,
    hash,
    start_param: params.get('start_param') ?? undefined,
  }
}
