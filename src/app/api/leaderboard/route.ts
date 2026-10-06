import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIELDS = `id, username, first_name, last_name, photo_url, trust_score, reviews_count, matches_count, avatar_frame, name_style, user_title, steam_id, steam_data`

/**
 * GET /api/leaderboard?sort=trust|races|reviews&steam=1&limit=10
 * Returns top users sorted by metric. Default: trust_score.
 * steam=1 — only Steam-linked users (Steam tab rating).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const sort = url.searchParams.get('sort') ?? 'trust'
  const steamOnly = url.searchParams.get('steam') === '1'
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 1), 50)

  let sortCol = 'trust_score'
  if (sort === 'races') sortCol = 'matches_count'
  if (sort === 'reviews') sortCol = 'reviews_count'

  let query = supabase
    .from('users')
    .select(FIELDS)
    .order(sortCol, { ascending: false })
    .limit(limit)

  if (steamOnly) {
    query = query.not('steam_id', 'is', null)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Get current user's rank
  const userId = req.headers.get('x-user-id')
  let myRank: number | null = null
  let myData: Record<string, unknown> | null = null
  if (userId) {
    const tgId = parseInt(userId, 10)
    myData = (data ?? []).find((u: Record<string, unknown>) => u.id === tgId) ?? null
    if (!myData) {
      let meQuery = supabase.from('users').select(FIELDS).eq('id', tgId)
      if (steamOnly) meQuery = meQuery.not('steam_id', 'is', null)
      const { data: me } = await meQuery.maybeSingle()
      if (me) {
        myData = me
        let countQuery = supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gt(sortCol, (me as Record<string, unknown>)[sortCol] as number)
        if (steamOnly) countQuery = countQuery.not('steam_id', 'is', null)
        const { count } = await countQuery
        myRank = (count ?? 0) + 1
      }
    } else {
      myRank = (data ?? []).findIndex((u: Record<string, unknown>) => u.id === tgId) + 1
    }
  }

  return NextResponse.json({
    leaderboard: data ?? [],
    my_rank: myRank,
    my_data: myData,
    sort,
    steam: steamOnly,
  })
}
