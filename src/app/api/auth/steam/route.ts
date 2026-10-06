import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/steam
 *
 * Starts Steam OpenID 2.0 sign-in.
 * Query: ?mode=login|link&anon=<id>
 *   - login: full Steam login (creates/logs into a Steam-primary account)
 *   - link:  attach Steam identity to the CURRENTLY logged-in TG account
 *            (requires existing tg_uid cookie)
 *   - anon:  optional id of the anonymous user to delete after successful login
 *
 * Redirects the browser to steamcommunity.com OpenID endpoint.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') === 'link' ? 'link' : 'login'
  const anonId = url.searchParams.get('anon') ?? ''

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || url.origin

  const returnUrl = `${origin}/api/auth/steam/callback?mode=${mode}${anonId ? `&anon=${encodeURIComponent(anonId)}` : ''}`
  const realm = origin

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  const response = NextResponse.redirect(
    `https://steamcommunity.com/openid/login?${params.toString()}`
  )

  // Remember the mode in a short-lived cookie so the callback can verify intent
  response.cookies.set('steam_auth_mode', mode, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600, // 10 min
  })

  return response
}
