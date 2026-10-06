import { NextRequest, NextResponse } from 'next/server'
import { supabase, type UserRow } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/me
 * Returns the current user based on tg_uid cookie.
 * Used by sub-pages (/friends, /leaderboard, /dm/[id], /rooms/[id]) to
 * avoid the full /api/auth flow (which requires initData).
 *
 * Returns 401 if not authenticated.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const tgUid = req.cookies.get('tg_uid')?.value
  if (!tgUid) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(tgUid, 10)
  if (isNaN(tgId)) {
    return NextResponse.json({ error: 'Invalid cookie' }, { status: 401 })
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', tgId)
    .maybeSingle<UserRow>()

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
