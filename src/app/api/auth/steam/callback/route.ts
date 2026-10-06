import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/steam/callback?mode=login|link
 *
 * Steam OpenID 2.0 return endpoint.
 * 1. Verifies the response with Steam (check_authentication)
 * 2. Extracts the 64-bit SteamID from claimed_id
 * 3. mode=login → creates / resumes a Steam-primary account (account_type='steam')
 *    mode=link  → attaches Steam to the current TG user (steam_id + verified badge)
 * 4. Redirects back to / with a status flag
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || url.origin

  try {
    // Collect ALL openid.* query params for verification
    const openidParams: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('openid.')) openidParams[key] = value
    })

    const claimedId = openidParams['openid.claimed_id'] ?? ''
    const steamIdMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)

    if (!steamIdMatch) {
      return redirectTo(origin, 'steam_error=bad_claim')
    }

    // ── Verify with Steam ──────────────────────────────────────────
    const verifyBody = new URLSearchParams({
      ...openidParams,
      'openid.mode': 'check_authentication',
    })
    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody.toString(),
    })
    const verifyText = await verifyRes.text()
    if (!verifyText.includes('is_valid:true')) {
      return redirectTo(origin, 'steam_error=invalid_signature')
    }

    const steamId = steamIdMatch[1]
    const anonToUpgrade = url.searchParams.get('anon')

    // Fetch persona (requires STEAM_API_KEY; optional)
    let personaName = `Steam ${steamId.slice(-4)}`
    let avatarUrl: string | null = null
    let profileUrl = `https://steamcommunity.com/profiles/${steamId}/`
    const apiKey = process.env.STEAM_API_KEY
    if (apiKey) {
      try {
        const res = await fetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = await res.json()
          const player = data?.response?.players?.[0]
          if (player) {
            personaName = player.personaname ?? personaName
            avatarUrl = player.avatarfull ?? avatarUrl
            profileUrl = player.profileurl ?? profileUrl
          }
        }
      } catch (err) {
        console.error('[steam-callback] persona fetch failed:', err)
      }
    }

    // ── Resolve mode ───────────────────────────────────────────────
    const modeCookie = req.cookies.get('steam_auth_mode')?.value
    const mode = url.searchParams.get('mode') === 'link' && modeCookie === 'link'
      ? 'link'
      : 'login'

    if (mode === 'link') {
      const tgUid = req.cookies.get('tg_uid')?.value
      const tgId = tgUid ? parseInt(tgUid, 10) : NaN

      if (isNaN(tgId)) {
        return redirectTo(origin, 'steam_error=no_session')
      }

      // Attach Steam to the current account
      const { data: updated, error } = await supabase
        .from('users')
        .update({
          steam_id: steamId,
          steam_linked_at: new Date().toISOString(),
          steam_data: {
            persona_name: personaName,
            avatar: avatarUrl,
            profile_url: profileUrl,
          },
          badges: await mergeVerifiedBadge(tgId),
        })
        .eq('id', tgId)
        .select('*')
        .maybeSingle<UserRow>()

      if (error || !updated) {
        console.error('[steam-callback] link error:', error)
        return redirectTo(origin, 'steam_error=db')
      }
      return redirectTo(origin, `steam_linked=1&uid=${updated.id}`)
    }

    // ── mode=login: create / resume Steam-primary account ──────────
    const steamNumericId = Number(steamId) // 76561... fits bigint

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('steam_id', steamId)
      .maybeSingle<UserRow>()

    let user: UserRow

    if (existing) {
      const { data: refreshed } = await supabase
        .from('users')
        .update({
          is_online: true,
          last_seen_at: new Date().toISOString(),
          steam_data: {
            persona_name: personaName,
            avatar: avatarUrl,
            profile_url: profileUrl,
          },
          ...(avatarUrl && !existing.photo_url ? { photo_url: avatarUrl } : {}),
        })
        .eq('id', existing.id)
        .select('*')
        .maybeSingle<UserRow>()
      user = refreshed ?? existing
    } else {
      const { data: created, error: insErr } = await supabase
        .from('users')
        .insert({
          id: steamNumericId,
          username: null,
          first_name: personaName,
          photo_url: avatarUrl,
          is_online: true,
          theme_color: 'steam',
          account_type: 'steam',
          steam_id: steamId,
          steam_linked_at: new Date().toISOString(),
          steam_data: {
            persona_name: personaName,
            avatar: avatarUrl,
            profile_url: profileUrl,
          },
          badges: ['verified'],
        })
        .select('*')
        .maybeSingle<UserRow>()

      if (insErr || !created) {
        console.error('[steam-callback] insert error:', insErr)
        return redirectTo(origin, 'steam_error=db')
      }
      user = created
    }

    // Upgrade flow: delete the anonymous user we came from (if any)
    if (anonToUpgrade && !isNaN(parseInt(anonToUpgrade, 10))) {
      const { error: delErr } = await supabase
        .from('users')
        .delete()
        .eq('id', parseInt(anonToUpgrade, 10))
        .eq('account_type', 'anonymous') // safety: only anon rows
      if (delErr) console.error('[steam-callback] anon delete error:', delErr)
    }

    const response = redirectTo(origin, `steam_login=1&uid=${user.id}`)
    response.cookies.set('tg_uid', String(user.id), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2592000,
    })
    response.cookies.set('theme_color', user.theme_color, {
      path: '/',
      sameSite: 'lax',
      maxAge: 31536000,
    })
    response.cookies.set('steam_auth_mode', '', { path: '/', maxAge: 0 })
    return response
  } catch (err) {
    console.error('[steam-callback] error:', err)
    return redirectTo(origin, 'steam_error=internal')
  }
}

/** Read current badges and add 'verified' if missing (returns full array). */
async function mergeVerifiedBadge(userId: number): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('badges')
    .eq('id', userId)
    .maybeSingle<{ badges: string[] }>()
  const badges = data?.badges ?? []
  return badges.includes('verified') ? badges : [...badges, 'verified']
}

function redirectTo(origin: string, query: string): NextResponse {
  return NextResponse.redirect(`${origin}/?${query}`)
}
