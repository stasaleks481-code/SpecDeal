import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { issueVoiceToken } from '@/lib/server/games'
import { getUserAllowedForAction, ANON_ERROR } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/[id]/voice-token
 *
 * Issues a short-lived (10 min TTL) HMAC-signed token for WebRTC signaling.
 * The token is bound to (userId, roomId) and required by
 * /api/rooms/[id]/signal GET/POST (verified with timing-safe compare).
 *
 * Only VERIFIED members of the room receive a token:
 *  - anonymous accounts are rejected (voice locked)
 *  - non-members are rejected
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const tgId = parseInt(userId, 10)
  if (isNaN(tgId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })

  const { id: roomId } = await params

  // Anonymous accounts cannot use voice
  const allowed = await getUserAllowedForAction(tgId, 'voice')
  if (!allowed) {
    const { data } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', tgId)
      .maybeSingle<{ account_type?: string }>()
    if (data?.account_type === 'anonymous') {
      return NextResponse.json({ error: ANON_ERROR, error_code: 'ACCOUNT_REQUIRED' }, { status: 403 })
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Room must be active
  const { data: room } = await supabase
    .from('rooms')
    .select('id, is_active')
    .eq('id', roomId)
    .maybeSingle()
  if (!room || !room.is_active) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // Requester must be a member (host is always a member)
  const { data: membership } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', tgId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Ты не участник этой комнаты' }, { status: 403 })
  }

  const { token, exp } = issueVoiceToken(tgId, roomId)
  return NextResponse.json({ token, exp })
}
