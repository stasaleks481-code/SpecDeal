import { NextRequest, NextResponse } from 'next/server'
import { supabase, REVIEW_TYPES, isEffectivelyOnline } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/users/[id]
 * Returns public profile of a user (for viewing other players' profiles).
 * Includes their recent reviews received.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const targetId = parseInt((await params).id, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  // Get user
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id, username, first_name, last_name, photo_url,
      steam_id, trust_score, reviews_count, matches_count,
      badges, is_online, last_seen_at, created_at,
      account_type, tg_link_data, show_tg_profile, steam_linked_at
    `)
    .eq('id', targetId)
    .maybeSingle()

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Privacy: hide the linked TG profile if the user opted out
  const u = user as Record<string, unknown>
  if (!u.show_tg_profile) {
    u.tg_link_data = null
  }

  // Effective online = flag + fresh heartbeat (fixes "stuck online")
  u.is_online = isEffectivelyOnline(
    u.is_online as boolean,
    u.last_seen_at as string
  )

  // Get recent reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, rating_type, comment, created_at,
      from_user:users!reviews_from_user_id_fkey(id, username, first_name, photo_url)
    `)
    .eq('to_user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Aggregate review type counts
  const reviewCounts: Record<string, number> = {}
  for (const r of (reviews ?? []) as Record<string, unknown>[]) {
    const type = r.rating_type as string
    reviewCounts[type] = (reviewCounts[type] ?? 0) + 1
  }

  return NextResponse.json({
    user,
    reviews: reviews ?? [],
    review_counts: reviewCounts,
  })
}
