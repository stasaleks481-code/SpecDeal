import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow } from '@/lib/supabase/client'
import { validateInitData } from '@/lib/telegram/initdata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth
 *
 * Modes (by body):
 *  1. { initData: string }            → Telegram auth (primary path in TMA)
 *     - Creates or updates the TG user
 *     - If a Steam-primary account has linked this TG profile, resumes THAT account
 *  2. { anonymous: true }             → Anonymous limited profile (negative id)
 *  3. {} (no initData, no anonymous)  → Session resume via tg_uid cookie
 *
 * Upgrade flow: after choosing TG/Steam, the anonymous user row is deleted
 * (body.upgrade_anon_id supplies its id) and the real account takes over.
 *
 * Response: { user: UserRow } and sets httpOnly cookies.
 */

const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 2592000, // 30 days
}

function withCookies(user: UserRow): NextResponse {
  const response = NextResponse.json({ user })
  response.cookies.set('tg_uid', String(user.id), COOKIE_OPTS)
  response.cookies.set('theme_color', user.theme_color, {
    path: '/',
    sameSite: 'lax',
    maxAge: 31536000,
  })
  return response
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}))
    const initData: string = body.initData ?? ''
    const wantsAnonymous: boolean = body.anonymous === true
    const upgradeAnonId: number | null = body.upgrade_anon_id ?? null

    // ── Mode 2: anonymous login (explicit "Войти анонимно") ────────
    if (wantsAnonymous) {
      // Reuse existing session user if the cookie already points to one
      const cookieUid = req.cookies.get('tg_uid')?.value
      if (cookieUid && !isNaN(parseInt(cookieUid, 10))) {
        const { data: sessionUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', parseInt(cookieUid, 10))
          .maybeSingle<UserRow>()
        if (sessionUser) {
          return withCookies(sessionUser)
        }
      }
      const anon = await createAnonymousUser()
      return withCookies(anon)
    }

    let telegramId: number
    let firstName: string
    let lastName: string | null = null
    let username: string | null = null
    let photoUrl: string | null = null
    let languageCode: string | null = null
    let telegramValidated = false
    let isDevFallback = false

    if (initData) {
      const validated = validateInitData(initData)
      telegramId = validated.user.id
      firstName = validated.user.first_name
      lastName = validated.user.last_name ?? null
      username = validated.user.username ?? null
      photoUrl = validated.user.photo_url ?? null
      languageCode = validated.user.language_code ?? null
      telegramValidated = true
    } else {
      // No initData — session resume via cookie (user already logged in)
      const cookieUid = req.cookies.get('tg_uid')?.value
      if (cookieUid && !isNaN(parseInt(cookieUid, 10))) {
        const { data: sessionUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', parseInt(cookieUid, 10))
          .maybeSingle<UserRow>()
        if (sessionUser) {
          // touch last seen, return without touching identity
          await supabase
            .from('users')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', sessionUser.id)
          return withCookies(sessionUser)
        }
      }

      // Dev fallback for local browser preview
      if (process.env.NODE_ENV !== 'production') {
        telegramId = 777000777
        firstName = 'DevPlayer'
        username = 'devplayer'
        isDevFallback = true
      } else {
        return NextResponse.json(
          {
            error: 'Открой это приложение через Telegram бота @stakappBot',
            error_code: 'NO_INIT_DATA',
          },
          { status: 400 }
        )
      }
    }

    // ── Mode 1: Telegram auth ──────────────────────────────────────
    // If a Steam account has LINKED this Telegram profile → resume it
    if (telegramValidated) {
      const { data: linkedSteamUser } = await supabase
        .from('users')
        .select('*')
        .eq('account_type', 'steam')
        .filter('tg_link_data->>id', 'eq', String(telegramId))
        .maybeSingle<UserRow>()

      if (linkedSteamUser) {
        // Refresh the TG snapshot + online flag on the steam account
        const { data: refreshed } = await supabase
          .from('users')
          .update({
            tg_link_data: {
              id: telegramId,
              username,
              first_name: firstName,
              last_name: lastName,
              photo_url: photoUrl,
            },
            is_online: true,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', linkedSteamUser.id)
          .select('*')
          .maybeSingle<UserRow>()

        if (upgradeAnonId && upgradeAnonId !== linkedSteamUser.id) {
          await deleteAnonUser(upgradeAnonId)
        }
        return withCookies(refreshed ?? linkedSteamUser)
      }
    }

    // Look up existing TG user
    const { data: existing, error: lookupErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', telegramId)
      .maybeSingle<UserRow>()

    if (lookupErr) {
      console.error('[auth] lookup error:', lookupErr)
      return NextResponse.json({ error: 'DB lookup failed' }, { status: 500 })
    }

    let user: UserRow

    if (existing) {
      // Update last-seen + Telegram fields (username/photo can change).
      // Do NOT overwrite photo/name if this is a Steam account (only linked).
      const { data: updated, error: updErr } = await supabase
        .from('users')
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          photo_url: photoUrl,
          language_code: languageCode,
          is_online: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', telegramId)
        .select('*')
        .maybeSingle<UserRow>()

      if (updErr || !updated) {
        console.error('[auth] update error:', updErr)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }
      user = updated
    } else {
      // ── NEW USER: per product spec, first entry gets an ANONYMOUS
      // profile. The client shows the Account Gate; choosing Telegram
      // (via upgrade_anon_id) or Steam unlocks the account.
      //
      // If a session cookie already points to a user (e.g. anon session),
      // resume it instead of creating a duplicate.
      const cookieUid = req.cookies.get('tg_uid')?.value
      if (cookieUid && !isNaN(parseInt(cookieUid, 10))) {
        const { data: sessionUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', parseInt(cookieUid, 10))
          .maybeSingle<UserRow>()
        if (sessionUser) {
          await supabase
            .from('users')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', sessionUser.id)
          return withCookies(sessionUser)
        }
      }

      // Dev fallback acts as a real Telegram account (for local testing)
      if (isDevFallback) {
        const { data: devCreated, error: devErr } = await supabase
          .from('users')
          .insert({
            id: telegramId,
            username,
            first_name: firstName,
            last_name: lastName,
            photo_url: photoUrl,
            language_code: languageCode,
            is_online: true,
            theme_color: 'cyan',
            account_type: 'telegram',
          })
          .select('*')
          .maybeSingle<UserRow>()
        if (devErr || !devCreated) {
          console.error('[auth] dev insert error:', devErr)
          return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
        }
        user = devCreated
      } else {
        user = await createAnonymousUser()
      }
    }

    if (upgradeAnonId && upgradeAnonId !== user.id) {
      await deleteAnonUser(upgradeAnonId)
    }

    return withCookies(user)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[auth] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Create or resume an anonymous (limited) user. Negative synthetic id. */
async function createAnonymousUser(): Promise<UserRow> {
  // Negative id in [-9e14, -8e14): never collides with Telegram (positive)
  // or Steam (~7.6e16) ids.
  const anonId = -Math.floor(8e14 + Math.random() * 1e14)

  const { data: created, error } = await supabase
    .from('users')
    .insert({
      id: anonId,
      first_name: 'Аноним',
      username: null,
      is_online: true,
      theme_color: 'cyan',
      account_type: 'anonymous',
      badges: [],
    })
    .select('*')
    .maybeSingle<UserRow>()

  if (error || !created) {
    console.error('[auth] anon insert error:', error)
    throw new Error('DB insert failed')
  }
  return created
}

/** Delete an anonymous user row (cascade removes their rooms/messages). */
async function deleteAnonUser(anonId: number): Promise<void> {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', anonId)
    .eq('account_type', 'anonymous') // safety: only ever delete anon rows
  if (error) {
    console.error('[auth] anon delete error:', error)
  }
}
