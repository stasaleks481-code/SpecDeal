import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/users/search?q=username
 * Searches users by username or first_name (case-insensitive, ILIKE).
 * Excludes the current user from results.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  // ILIKE search on username OR first_name
  const { data, error } = await supabase
    .from('users')
    .select('id, username, first_name, last_name, photo_url, is_online')
    .or(`username.ilike.%${q}%,first_name.ilike.%${q}%`)
    .neq('id', tgId)
    .limit(10)

  if (error) {
    console.error('[search] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
