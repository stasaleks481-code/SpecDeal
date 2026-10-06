import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/[id]/moderate
 * Host-only moderation actions.
 * Body: { action: 'kick' | 'mute' | 'end_call', target_id?: number }
 *
 *  - kick: removes the target from room_members and broadcasts a 'kick' signal
 *  - mute: broadcasts a 'mute' signal (target's client force-mutes the mic)
 *  - end_call: broadcasts a 'close' signal (scope: voice) — ends the voice
 *    call for EVERY participant at once (room itself stays open)
 *
 * Signals are delivered in real-time via the call_signals table
 * (Supabase Realtime subscription on the client).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const hostId = parseInt(userId, 10)
  if (isNaN(hostId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const { id: roomId } = await params
  const body = await req.json().catch(() => ({}))

  const action = body.action as 'kick' | 'mute' | 'end_call'
  const targetId = body.target_id !== undefined ? parseInt(body.target_id, 10) : NaN

  if (action !== 'kick' && action !== 'mute' && action !== 'end_call') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (action !== 'end_call' && (isNaN(targetId) || targetId === hostId)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  // Verify requester is the room host
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, is_active')
    .eq('id', roomId)
    .maybeSingle()

  if (!room || !room.is_active) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }
  if (room.host_id !== hostId) {
    return NextResponse.json({ error: 'Только хост может модерировать' }, { status: 403 })
  }

  // Verify target is actually a member of this room (not needed for end_call)
  if (action !== 'end_call') {
    const { data: membership } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', targetId)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Участник не в комнате' }, { status: 404 })
    }
  }

  // ── Execute action ─────────────────────────────────────────────
  if (action === 'end_call') {
    // Broadcast "call over" to everyone (to_user_id = null)
    const { error: closeErr } = await supabase
      .from('call_signals')
      .insert({
        room_id: roomId,
        from_user_id: hostId,
        to_user_id: null,
        type: 'close',
        payload: { scope: 'voice', by_host: hostId },
      })
    if (closeErr) {
      console.error('[moderate] end_call signal error:', closeErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'kick') {
    const { error: delErr } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', targetId)
    if (delErr) {
      console.error('[moderate] kick db error:', delErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  // Broadcast moderation signal to the target (and everyone — for UI updates)
  const { error: sigErr } = await supabase
    .from('call_signals')
    .insert({
      room_id: roomId,
      from_user_id: hostId,
      to_user_id: targetId,
      type: action,
      payload: { action, target_id: targetId, by_host: hostId },
    })

  if (sigErr) {
    console.error('[moderate] signal error:', sigErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
