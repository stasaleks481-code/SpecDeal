import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/friends
 * Returns current user's friends (accepted) and pending requests (incoming + outgoing).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)

  // Accepted friends (either direction)
  const { data: accepted, error: aErr } = await supabase
    .from('friends')
    .select(`
      id,
      user_id_1,
      user_id_2,
      status,
      created_at,
      accepted_at,
      friend1:users!friends_user_id_1_fkey(id, username, first_name, last_name, photo_url, is_online, last_seen_at, trust_score),
      friend2:users!friends_user_id_2_fkey(id, username, first_name, last_name, photo_url, is_online, last_seen_at, trust_score)
    `)
    .or(`user_id_1.eq.${tgId},user_id_2.eq.${tgId}`)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false, nullsFirst: false })

  if (aErr) {
    console.error('[friends] GET accepted error:', aErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Incoming pending requests (someone sent to me)
  const { data: incoming } = await supabase
    .from('friends')
    .select(`
      id,
      user_id_1,
      user_id_2,
      created_at,
      from_user:users!friends_user_id_1_fkey(id, username, first_name, last_name, photo_url, is_online, trust_score)
    `)
    .eq('user_id_2', tgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Outgoing pending requests (I sent to someone)
  const { data: outgoing } = await supabase
    .from('friends')
    .select(`
      id,
      user_id_1,
      user_id_2,
      created_at,
      to_user:users!friends_user_id_2_fkey(id, username, first_name, last_name, photo_url, is_online, trust_score)
    `)
    .eq('user_id_1', tgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Normalize friends — extract the OTHER user (not me)
  const friends = (accepted ?? []).map((row: Record<string, unknown>) => {
    const isUser1 = row.user_id_1 === tgId
    const friendData = isUser1 ? row.friend2 : row.friend1
    return {
      friendship_id: row.id,
      user: friendData,
      since: row.accepted_at ?? row.created_at,
    }
  })

  const incomingRequests = (incoming ?? []).map((row: Record<string, unknown>) => ({
    request_id: row.id,
    from: row.from_user,
    created_at: row.created_at,
  }))

  const outgoingRequests = (outgoing ?? []).map((row: Record<string, unknown>) => ({
    request_id: row.id,
    to: row.to_user,
    created_at: row.created_at,
  }))

  return NextResponse.json({
    friends,
    incoming: incomingRequests,
    outgoing: outgoingRequests,
  })
}

/**
 * POST /api/friends
 * Body: { target_id: number }
 * Sends a friend request to target_id. If they already sent one to me,
 * auto-accepts instead of creating a duplicate.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tgId = parseInt(userId, 10)
  const body = await req.json().catch(() => ({}))
  const targetId = parseInt(body.target_id, 10)

  if (isNaN(targetId) || targetId === tgId) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  // Check if target exists
  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', targetId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check if there's already a friendship row (in either direction)
  const { data: existing } = await supabase
    .from('friends')
    .select('id, user_id_1, user_id_2, status')
    .or(`and(user_id_1.eq.${tgId},user_id_2.eq.${targetId}),and(user_id_1.eq.${targetId},user_id_2.eq.${tgId})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ error: 'Already friends' }, { status: 400 })
    }
    if (existing.status === 'pending') {
      // If THEY sent me a request, auto-accept
      if (existing.user_id_1 === targetId && existing.user_id_2 === tgId) {
        const { error } = await supabase
          .from('friends')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
        return NextResponse.json({ ok: true, accepted: true })
      }
      // Otherwise I already sent one
      return NextResponse.json({ error: 'Request already sent' }, { status: 400 })
    }
  }

  // Create new pending request
  const { error } = await supabase
    .from('friends')
    .insert({
      user_id_1: tgId,
      user_id_2: targetId,
      status: 'pending',
    })

  if (error) {
    console.error('[friends] POST error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, accepted: false })
}
