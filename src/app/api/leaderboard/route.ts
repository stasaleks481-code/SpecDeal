import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard?sort=trust|races|matches
 * Returns top 10 users sorted by metric. Default: trust_score.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const sort = url.searchParams.get('sort') ?? 'trust'

  let sortCol = 'trust_score'
  if (sort === 'races') sortCol = 'matches_count'
  if (sort === 'reviews') sortCol = 'reviews_count'

  const { data, error } = await supabase
    .from('users')
    .select('id, username, first_name, last_name, photo_url, trust_score, reviews_count, matches_count')
    .order(sortCol, { ascending: false })
    .limit(10)

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
      // Get total count of users with higher score
      const { data: me } = await supabase
        .from('users')
        .select(`id, username, first_name, last_name, photo_url, trust_score, reviews_count, matches_count`)
        .eq('id', tgId)
        .maybeSingle()
      if (me) {
        myData = me
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gt(sortCol, me.trust_score as number)
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
  })
}
