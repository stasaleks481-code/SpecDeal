import { NextRequest, NextResponse } from 'next/server'
import { supabase, isEffectivelyOnline } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?q=&sort=&page=
 * User management list with search, sorting, pagination.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req)
  if (denied) return denied

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  const sort = url.searchParams.get('sort') ?? 'created_at'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = 30

  let query = supabase
    .from('users')
    .select(`
      id, username, first_name, last_name, photo_url, account_type,
      trust_score, reviews_count, matches_count, badges, is_banned,
      is_online, last_seen_at, steam_id, theme_color, created_at
    `, { count: 'exact' })

  if (q) {
    const asNum = parseInt(q, 10)
    // Search by id (exact), username or name (ilike)
    if (!isNaN(asNum)) {
      query = query.eq('id', asNum)
    } else {
      query = query.or(`username.ilike.%${q}%,first_name.ilike.%${q}%`)
    }
  }

  const sortMap: Record<string, string> = {
    created_at: 'created_at',
    trust_score: 'trust_score',
    last_seen: 'last_seen_at',
    reviews: 'reviews_count',
  }
  const orderBy = sortMap[sort] ?? 'created_at'
  query = query.order(orderBy, { ascending: false })

  const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1)

  if (error) {
    console.error('[admin/users] error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const users = (data ?? []).map((u: Record<string, unknown>) => ({
    ...u,
    is_online: isEffectivelyOnline(u.is_online as boolean, u.last_seen_at as string),
  }))

  return NextResponse.json({
    users,
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  })
}
