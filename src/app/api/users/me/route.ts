import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow, THEME_COLORS } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/me
 * Headers: X-User-Id (set by middleware from tg_uid cookie)
 * Body: {
 *   theme_color?: 'cyan'|'pink'|'green'|'amber'|'steam',
 *   username?, photo_url?,
 *   show_tg_profile?: boolean,   — Steam-primary: show linked TG profile to others
 *   onboarding_done?: boolean,   — tour completion flag
 * }
 *
 * Updates the current user's profile. Returns the updated user row.
 * Also sets a `theme_color` cookie so the theme persists on next page load.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  if (isNaN(tgId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))

  const updates: Partial<UserRow> = {}

  if (body.theme_color) {
    if (!THEME_COLORS[body.theme_color as keyof typeof THEME_COLORS]) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
    updates.theme_color = body.theme_color
  }

  if (body.username !== undefined) updates.username = body.username
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url
  if (typeof body.show_tg_profile === 'boolean') {
    updates.show_tg_profile = body.show_tg_profile
  }
  if (typeof body.onboarding_done === 'boolean') {
    updates.onboarding_done = body.onboarding_done
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', tgId)
    .select('*')
    .maybeSingle<UserRow>()

  if (error || !data) {
    console.error('[users] update error:', error)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // Set theme cookie so it persists across page reloads (1 year expiry)
  const response = NextResponse.json({ user: data })
  if (data.theme_color) {
    response.cookies.set('theme_color', data.theme_color, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
    })
  }
  return response
}
