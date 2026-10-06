import { NextRequest, NextResponse } from 'next/server'
import { supabase, REVIEW_TYPES } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews
 * Body: { to_user_id: number, rating_type: string, comment?: string, room_id?: string }
 * Leaves a review for another user. Updates their trust_score + reviews_count.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const body = await req.json().catch(() => ({}))

  const toUserId = parseInt(body.to_user_id, 10)
  if (isNaN(toUserId) || toUserId === tgId) {
    return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
  }

  const ratingType = body.rating_type as keyof typeof REVIEW_TYPES
  if (!REVIEW_TYPES[ratingType]) {
    return NextResponse.json({ error: 'Invalid rating type' }, { status: 400 })
  }

  const comment = body.comment ? String(body.comment).slice(0, 500) : null
  const roomId = body.room_id ?? null

  // Check target user exists
  const { data: target } = await supabase
    .from('users')
    .select('id, trust_score, reviews_count')
    .eq('id', toUserId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check duplicate review (same from → to in same room)
  let dupQuery = supabase
    .from('reviews')
    .select('id')
    .eq('from_user_id', tgId)
    .eq('to_user_id', toUserId)

  if (roomId) {
    dupQuery = dupQuery.eq('room_id', roomId)
  } else {
    dupQuery = dupQuery.is('room_id', null)
  }

  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Already reviewed this user' }, { status: 400 })
  }

  // Insert review
  const { error } = await supabase
    .from('reviews')
    .insert({
      from_user_id: tgId,
      to_user_id: toUserId,
      rating_type: ratingType,
      comment,
      room_id: roomId,
    })

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Update target's trust_score + reviews_count
  const scoreDelta = REVIEW_TYPES[ratingType].score
  const newScore = Math.max(-100, target.trust_score + scoreDelta)
  const newCount = target.reviews_count + 1

  await supabase
    .from('users')
    .update({
      trust_score: newScore,
      reviews_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', toUserId)

  return NextResponse.json({
    ok: true,
    new_trust_score: newScore,
    new_reviews_count: newCount,
  })
}
